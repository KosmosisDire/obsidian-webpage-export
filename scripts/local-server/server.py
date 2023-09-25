from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import webbrowser


website = json.loads(open('website.json').read()) # dictionary relating paths to file data


class Serv(BaseHTTPRequestHandler):

	def do_GET(self):
		if self.path in website:
			self.send_response(200)
			self.end_headers()
			self.wfile.write(bytes(website[self.path],'utf-8'))
		else:
			self.send_response(404)
			self.end_headers()
			self.wfile.write(bytes('404 Not Found','utf-8'))

httpd = HTTPServer(('localhost',8080),Serv)

# open http://localhost:8080/ in the browser
webbrowser.open('http://localhost:8080/')

httpd.serve_forever()
