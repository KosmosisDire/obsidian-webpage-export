from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import webbrowser

database_string = open('database.json','r', encoding='utf-8').read()
website = json.loads(database_string) # dictionary relating paths to file data


class Serve(BaseHTTPRequestHandler):

	def do_GET(self):		
		if self.path == '/':
			self.path = 'index.html'

		if(self.path.startswith("/")):
			self.path = self.path[1:]

		print(self.path)

		if self.path in website:
			self.send_response(200)
			self.end_headers()
			self.wfile.write(bytes(website[self.path],'utf-8'))
		else:
			self.send_response(404)
			self.end_headers()
			self.wfile.write(bytes('404 Not Found','utf-8'))

httpd = HTTPServer(('localhost',8080),Serve)

# open http://localhost:8080/ in the browser
webbrowser.open('http://localhost:8080/')

httpd.serve_forever()
