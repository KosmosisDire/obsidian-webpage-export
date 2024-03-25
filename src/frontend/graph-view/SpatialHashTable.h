#include <unordered_map>
#include <unordered_set>
#include <vector>
#include <Dense.h>

struct AbstractedGridspace {
    Eigen::Vector2f position;
    int numObjects;
    int weightsSum;
};

enum class GridspacePositionCalculationMethod 
{
    AVERAGE,
    WEIGHTED_AVERAGE,
    CENTER
};


class SpatialHashingTable {
public:
    SpatialHashingTable(float cellSize) : cellSize_(cellSize) {}

    std::vector<int> getNearbyObjects(const Eigen::Vector2f& position, float radius) const
    {
        // Compute the set of cells that overlap with the circle defined by the radius and position
        std::unordered_set<int> cells = findCells(position, radius);

        // Collect all objects that belong to any of the overlapping cells
        std::unordered_set<int> nearbyObjects;
        for (int cell : cells) {
            std::unordered_set objectsInCell = objects_.find(cell)->second;
            nearbyObjects.insert(objectsInCell.begin(), objectsInCell.end());
        }

        return std::vector<int>(nearbyObjects.begin(), nearbyObjects.end());
    }

    std::vector<AbstractedGridspace> getAbstractedGrid(GridspacePositionCalculationMethod calcMethod, float* weights = nullptr) 
    {
        std::vector<AbstractedGridspace> grid;

        for (const auto& [cell, objects] : objects_) 
        {
            Eigen::Vector2f center = computeCellCenter(cell, calcMethod, weights);
            int numObjects = static_cast<int>(objects.size());
            int weightsSum = 0;

            for (int object : objects) {
                weightsSum += weights[object];
            }

            grid.push_back({center, numObjects, weightsSum});
        }

        return grid;
    }

    std::vector<AbstractedGridspace> getFarAbstractedGrid(const Eigen::Vector2f& position, float radius, GridspacePositionCalculationMethod calcMethod) 
    {
        std::vector<AbstractedGridspace> farGrid;

        for (const auto& [cell, objects] : objects_) {
            Eigen::Vector2f center = computeCellCenter(cell, calcMethod);

            // Check if the cell is outside the radius from the position
            if ((center - position).norm() > radius) {
                int numObjects = static_cast<int>(objects.size());
                farGrid.push_back({center, numObjects});
            }
        }

        return farGrid;
    }

    std::vector<int> getObjectsInCell(const Eigen::Vector2f& position) const
    {
        int cell = findCell(position);

        std::unordered_set<int> nearbyObjects;
        std::unordered_set<int> objectsInCell = objects_.find(cell)->second;
        nearbyObjects.insert(objectsInCell.begin(), objectsInCell.end());

        return std::vector<int>(nearbyObjects.begin(), nearbyObjects.end());
    }

    void update(Eigen::Vector2f* positions, int numPositions)
    {
        clear();

        for (int i = 0; i < numPositions; ++i) 
        {
            add(i, positions[i]);
        }

        positions_ = positions;
    }

    void clear() 
    {
        objects_.clear();
        occupiedCells_.clear();
    }

    float getCellSize() const 
    {
        return cellSize_;
    }


private:
    std::unordered_map<int, std::unordered_set<int>> objects_; // maps cell IDs to sets of object indices
    std::unordered_map<int, std::unordered_set<int>> occupiedCells_; // maps object indices to sets of cell IDs
    Eigen::Vector2f* positions_;
    int numPositions_;
    float cellSize_;

    std::unordered_set<int> findCells(const Eigen::Vector2f& position, float radius = 0.0f) const 
    {
        // Compute the range of cells that overlap with the circle defined by the radius and position
        float cellRadius = radius + cellSize_ / 2;
        int left = static_cast<int>(std::floor((position.x() - cellRadius) / cellSize_));
        int right = static_cast<int>(std::floor((position.x() + cellRadius) / cellSize_));
        int top = static_cast<int>(std::floor((position.y() - cellRadius) / cellSize_));
        int bottom = static_cast<int>(std::floor((position.y() + cellRadius) / cellSize_));

        // Add all cells within the range to the set of occupied cells
        std::unordered_set<int> cells;
        for (int x = left; x <= right; ++x) {
            for (int y = top; y <= bottom; ++y) {
                int cell = x + y * (1 << 16); // combine x and y into a single integer key
                cells.insert(cell);
            }
        }

        return cells;
    }

    int findCell(const Eigen::Vector2f& position) const 
    {
        int x = static_cast<int>(std::floor(position.x() / cellSize_));
        int y = static_cast<int>(std::floor(position.y() / cellSize_));
        return x + y * (1 << 16); // combine x and y into a single integer key
    }

    Eigen::Vector2f computeCellCenter(int cell, GridspacePositionCalculationMethod calcMethod, float* weights = nullptr) const
    {
        if(calcMethod == GridspacePositionCalculationMethod::AVERAGE)
        {
            // Compute the average position of all objects in the cell

            Eigen::Vector2f center(0.0f, 0.0f);
            
            std::unordered_set<int> objects = objects_.find(cell)->second;

            for (int objectIndex : objects) 
            {
                center += positions_[objectIndex];
            }

            return center / static_cast<float>(objects.size());
        }
        else if(calcMethod == GridspacePositionCalculationMethod::WEIGHTED_AVERAGE)
        {
            // Compute the weighted average position of all objects in the cell

            Eigen::Vector2f center(0.0f, 0.0f);
            float weightsSum = 0.0f;

            for (int objectIndex : objects_.find(cell)->second)
            {
                center += positions_[objectIndex] * weights[objectIndex];
                weightsSum += weights[objectIndex];
            }

            return center / weightsSum;
        }
        else if(calcMethod == GridspacePositionCalculationMethod::CENTER) 
        {
            // Compute the center position of the cell given its unique ID

            int x = cell & 0xFFFF;
            int y = (cell >> 16) & 0xFFFF;
            return Eigen::Vector2f((x + 0.5f) * cellSize_, (y + 0.5f) * cellSize_);
        }

        return Eigen::Vector2f(0.0f, 0.0f);
    }

    void add(int objectIndex, const Eigen::Vector2f& position) 
    {
        // Compute the set of cells that the object occupies
        std::unordered_set<int> cells = findCells(position);

        // Add the object index to the set of objects for each occupied cell
        for (int cell : cells) {
            objects_[cell].insert(objectIndex);
        }

        // Store the set of cells that the object occupies
        occupiedCells_[objectIndex] = std::move(cells);
    }

    void remove(int objectIndex) 
    {
        // Remove the object index from the set of objects for each occupied cell
        for (int cell : occupiedCells_[objectIndex]) {
            objects_[cell].erase(objectIndex);
        }

        // Remove the object's occupied cells from the map
        occupiedCells_.erase(objectIndex);
    }
};
