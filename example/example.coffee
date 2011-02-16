connect = require 'connect'
connectCoffee = require 'connect-coffee'

server = connect.createServer connect.staticProvider(__dirname + '/public'),
                              connectCoffee(__dirname + '/public')

server.listen 3000  # navigate to http://localhost:3000/