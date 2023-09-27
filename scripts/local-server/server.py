from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import webbrowser
import mimetypes
import base64

database_string = open('C:/Main Documents/Obsidian/Export/database.json','r', encoding='utf-8').read()
website = json.loads(database_string) # dictionary relating paths to file data


html_404 = """
<!DOCTYPE html>
<html>
	<head>
		<link rel="stylesheet" href="/lib/styles/obsidian-styles.css">
		<link rel="stylesheet" href="/lib/styles/theme.css">
	</head>
	<body style="background-color: var(--background-primary);">
		<h1 style="position: absolute; top: 50%; left: 50%; translate: -50%, -50%;">404 Not Found</h1>
	</body>
<html>
"""

class Serve(BaseHTTPRequestHandler):

	def do_GET(self):		
		if self.path == '/':
			self.path = 'index.html'
			if not self.path in website:
				# return first html file in website
				self.path = next(p for p in list(website.keys()) if p.endswith(".html"))
				print("index.html does not exist. Using", self.path, "instead.")

		if(self.path.startswith("/")):
			self.path = self.path[1:]

		ext = "." + self.path.split(".")[-1]

		

		if self.path in website:
			data = website[self.path]

			self.send_response(200)
			self.send_header('Content-type', mimetypes.types_map[ext])
			self.end_headers()

			if ext == ".html" or ext == ".css" or ext == ".js":
				response = bytes(data,'utf-8')
				self.wfile.write(response)
			else:
				response = base64.decodebytes(bytes(data, 'utf-8'))
				self.wfile.write(response)
		else:
			self.send_response(404)
			self.end_headers()
			self.wfile.write(bytes(html_404,'utf-8'))

httpd = HTTPServer(('localhost',8080),Serve)

# open http://localhost:8080/ in the browser
webbrowser.open('http://localhost:8080/')

httpd.serve_forever()
