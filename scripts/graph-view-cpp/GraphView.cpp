#include "Dense.h"
#include <vector>
#include <cstdlib>
#include <ctime>
#include <stdarg.h>
#include <algorithm>
#include <emscripten.h>
#include "SpatialHashTable.h"

using namespace Eigen;

Vector2f* positions;
Vector2f* connectedDeltas;
Vector2f* lastConnectedDeltas;
Vector2f* forces;
Vector2f massOffsetFromCenterAccumulator;
Vector2f massOffsetFromCenter;
float* radii;
int* linkSources;
int* linkTargets;
int* linkCounts;
float* maxRadiiLinks;

int totalNodes = 0;
int totalLinks = 0;
float maxRadius = 0;
float minRadius = 0;

float dt = 0.01f;

float attractionForce = 0;
float linkLength = 0;
float repulsionForce = 0;
float centralForce = 0;

float batchFractionSize = 1.0f;
int batchSize = 0;
int batchOffset = 0;
int nextBatchOffset = 0;
int batchesPerRound = 0;

int hoveredNode = -1;

SpatialHashingTable table = NULL;

float rand01()
{
    return static_cast <float> (rand()) / static_cast <float> (RAND_MAX);
}

void print(const char* fmt, ...)
{
    va_list arg;
    va_start(arg, fmt);

    char buffer[1024];
    vsprintf(buffer, fmt, arg);

    EM_ASM_ARGS({
        console.log(UTF8ToString($0));
    }, buffer);

    va_end(arg);
}

void swap(Vector2f** a, Vector2f** b)
{
    Vector2f *temp = *a;
    *a = *b;
    *b = temp;
}

float gaussianPlatau(float x, float width, float baseline = 0.1)
{
    float x_wdith = x/width;
    return (1-baseline) * 1/(1+x_wdith*x_wdith) + baseline;
}


extern "C" 
{

EMSCRIPTEN_KEEPALIVE
void SetBatchFractionSize(float fraction)
{
    batchFractionSize = fraction;
    batchSize = std::min(std::max((int)(totalNodes * batchFractionSize), 50), totalNodes);
    batchesPerRound = std::ceil(std::max(totalNodes / batchSize, 1));
}

EMSCRIPTEN_KEEPALIVE
void SetAttractionForce(float _attractionForce)
{
    attractionForce = _attractionForce;
}

EMSCRIPTEN_KEEPALIVE
void SetLinkLength(float _linkLength)
{
    linkLength = _linkLength;
}

EMSCRIPTEN_KEEPALIVE
void SetRepulsionForce(float _repulsionForce)
{
    repulsionForce = _repulsionForce;
}

EMSCRIPTEN_KEEPALIVE
void SetCentralForce(float _centralForce)
{
    centralForce = _centralForce;
}

EMSCRIPTEN_KEEPALIVE
void SetDt(float _dt)
{
    dt = _dt;
}

EMSCRIPTEN_KEEPALIVE
void Init(Vector2f* _positions, float* _radii, int* _linkSources, int* _linkTargets, int _totalNodes, int _totalLinks, float batchFraction, float _dt, float _attractionForce, float _linkLength, float _repulsionForce, float _centralForce)
{
    print("Init called");

    totalNodes = _totalNodes;
    totalLinks = _totalLinks;
    batchFractionSize = batchFraction;

    dt = _dt;
    attractionForce = _attractionForce;
    linkLength = _linkLength;
    repulsionForce = _repulsionForce;
    centralForce = _centralForce;

    positions = _positions;
    forces = new Vector2f[totalNodes];
    connectedDeltas = new Vector2f[totalNodes];
    lastConnectedDeltas = new Vector2f[totalNodes];
    radii = _radii;
    linkSources = _linkSources;
    linkTargets = _linkTargets;
    linkCounts = new int[totalNodes];
    maxRadiiLinks = new float[totalNodes];

    maxRadius = 0;
    minRadius = 1000000;
    for (int i = 0; i < totalNodes; i++)
    {
        maxRadius = std::max(maxRadius, radii[i]);
        minRadius = std::min(minRadius, radii[i]);
        maxRadiiLinks[i] = 0;
    }

    for (int i = 0; i < totalLinks; i++)
    {
        linkCounts[linkSources[i]]++;
        linkCounts[linkTargets[i]]++;

        maxRadiiLinks[linkSources[i]] = std::max(maxRadiiLinks[linkSources[i]], radii[linkTargets[i]]);
        maxRadiiLinks[linkTargets[i]] = std::max(maxRadiiLinks[linkTargets[i]], radii[linkSources[i]]);
    }

    SetBatchFractionSize(batchFractionSize);

    table = SpatialHashingTable(maxRadius);
}

float settleness = 1.0f;

EMSCRIPTEN_KEEPALIVE
int Update(float mouseX, float mouseY, int grabbedNode, float cameraScale)
{
    Vector2f mousePos = Vector2f(mouseX, mouseY);

    if(grabbedNode != -1) 
    {
        settleness = 1.0f;
        if(grabbedNode < totalNodes)
            positions[grabbedNode] = mousePos;
        else
        {
            print("Grabbed node is out of bounds");
        }
    }

    swap(&connectedDeltas, &lastConnectedDeltas);

    for (int i = 0; i < totalNodes; i++)
    {
        connectedDeltas[i] = Vector2f(0, 0);
        forces[i] = Vector2f(0, 0);
    }

    float multiplier = multiplier = std::min(attractionForce, 1.0f);
    float maxRadiusSqr = maxRadius * maxRadius;

    for (int i = 0; i < totalLinks; i++)
    {
        int target = linkTargets[i];
        int source = linkSources[i];
        if (target == source) continue;

        if(target >= totalNodes || source >= totalNodes)
        {
            print("Link target or source is out of bounds");
            continue;
        }

        Vector2f targetPos = positions[target];
        Vector2f sourcePos = positions[source];
        Vector2f delta = targetPos - sourcePos;

        connectedDeltas[source] += delta;
        connectedDeltas[target] += -delta;

        float sourceRadius = radii[source];
        float targetRadius = radii[target];

        float distance = delta.norm();
        if (distance <= 1)
        {
            positions[source] += Vector2f((rand01() - 0.5) * (sourceRadius + targetRadius), (rand01() - 0.5) * (sourceRadius + targetRadius));
            continue;
        }

        Vector2f normalizedDelta = delta / distance;
        float distanceDelta = distance - sourceRadius - targetRadius - linkLength;
        Vector2f sourceTargetPos = sourcePos + normalizedDelta * distanceDelta;
        Vector2f targetSourcePos = targetPos - normalizedDelta * distanceDelta;

        
        Vector2f sourceForce = (sourceTargetPos - sourcePos) * multiplier * (targetRadius / maxRadiiLinks[source]);
        Vector2f targetForce = (targetSourcePos - targetPos) * multiplier * (sourceRadius / maxRadiiLinks[target]);

        forces[target] += targetForce / linkCounts[target];
        forces[source] += sourceForce / linkCounts[source];
    }

    std::srand(std::time(nullptr));

    float settlnessAccumulator = 0.0f;

    int repelEnd = std::min(batchOffset + std::max((int)ceil(batchSize * (log(50.0f * settleness)/1.7f)), 1), totalNodes);

    bool foundHovered = false;
    bool firstRun = true;
    for (int i = batchOffset; i < repelEnd; i++)
    {
        nextBatchOffset = (i + 1) % totalNodes;

        Vector2f nodePosition = positions[i];
        float nodeR = radii[i];

        Vector2f nodeForce = Vector2f::Zero();

        for (int j = 0; j < totalNodes; j++)
        {
            if (firstRun)
            {
                // find hovered node
                if (!foundHovered)
                {
                    float dist = (positions[j] - mousePos).norm();
                    if (dist < radii[j] / sqrt(cameraScale))
                    {
                        hoveredNode = j;
                        foundHovered = true;
                    }
                }

                // if (j < batchOffset || j > repelEnd)
                // {
                //     positions[j] += forces[j] * dt * settleness;
                // }

                massOffsetFromCenterAccumulator += positions[j];

                // positions[j] -= massOffsetFromCenter.normalized() * dt;
            }


            if (i == j) continue;

            Vector2f otherPosition = positions[j];
            float otherR = radii[j];

            Vector2f delta = nodePosition - otherPosition;
            float distanceSqr = delta.squaredNorm();

            if (distanceSqr <= 1)
            {
                positions[i] += Vector2f((rand01() - 0.5) * (nodeR + otherR), (rand01() - 0.5) * (nodeR + otherR));
                continue;
            }

            float maxCube = maxRadius * maxRadius * maxRadius;
            float otherCube = otherR * otherR * otherR;
            float nodeCube = nodeR * nodeR * nodeR;
            
            float force = (gaussianPlatau(sqrt(distanceSqr), 2.0f * (nodeR + otherR), 0.01f) * (otherCube/maxCube) / (nodeCube/maxCube) + (nodeR/maxRadius)) / (distanceSqr) * repulsionForce;
            // force += 0.001f/sqrt(distanceSqr);

            nodeForce += delta * force;
        }

        firstRun = false;

        // center forces
        float distance = nodePosition.norm();
        float force = distance * centralForce/1000 * (nodeR/maxRadius) * (nodeR/maxRadius);
        nodeForce += -nodePosition * force;

        float batchFraction = batchFractionSize / 2;

        nodeForce = Vector2f
        (
            (batchFraction) * nodeForce.x()  + (1 - (batchFraction)) * forces[i].x(),
            (batchFraction) * nodeForce.y()  + (1 - (batchFraction)) * forces[i].y()
        ) * settleness;

        if (nodeForce.norm() > maxRadiusSqr)
        {
            nodeForce = nodeForce / nodeForce.norm() * maxRadiusSqr;
        }

        forces[i] = nodeForce * 0.9f;

        positions[i] += forces[i] * dt;

        if(grabbedNode == i) 
        {
            positions[grabbedNode] = mousePos;
        }


        settlnessAccumulator += ((connectedDeltas[i] - lastConnectedDeltas[i]).norm() + (connectedDeltas[i].normalized() - lastConnectedDeltas[i].normalized()).norm()) / 2;
    }

    batchOffset = nextBatchOffset;

    settleness = settleness * 0.95f + std::min(settlnessAccumulator/totalNodes, 5.0f) * 0.01f;


    massOffsetFromCenter = massOffsetFromCenterAccumulator / totalNodes;

    if(grabbedNode != -1) 
    {
        positions[grabbedNode] = mousePos;
        return grabbedNode;
    }
    
    return foundHovered ? hoveredNode : -1;
}

EMSCRIPTEN_KEEPALIVE
void SetPosition(int index, float x, float y)
{
    positions[index] = Vector2f(x, y);
}



void AbstractedUpdate()
{
    std::vector<AbstractedGridspace> abstractedGrid = table.getAbstractedGrid(GridspacePositionCalculationMethod::WEIGHTED_AVERAGE, radii);

    for (int i = 0; i < totalNodes; i++)
    {
        Vector2f nodePosition = positions[i];
        float nodeRadius = radii[i];

        for (int j = 0; j < abstractedGrid.size(); j++)
        {
            Vector2f gridSpacePosition = abstractedGrid[j].position;
            float spaceStrength = abstractedGrid[j].weightsSum;
            Vector2f delta = gridSpacePosition - nodePosition;

            float distSqr = delta.dot(delta);
            if (distSqr <= 0.00001)
            {
                positions[i] += Vector2f(1, 0);
                continue;
            }

            float dist = sqrt(distSqr);
            Vector2f normalizedDelta = delta / dist;
            Vector2f force = normalizedDelta * repulsionForce * dt * spaceStrength;

            positions[i] -= force;
        }

        Vector2f centralForceVector = -nodePosition.normalized() * centralForce;
        positions[i] += centralForceVector * dt * settleness;
    }
}

EMSCRIPTEN_KEEPALIVE
void FreeMemory()
{
    delete[] forces;
    delete[] linkCounts;
    delete[] maxRadiiLinks;
    delete[] connectedDeltas;
    delete[] lastConnectedDeltas;
}

}