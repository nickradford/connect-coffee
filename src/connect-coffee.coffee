# **connect-coffee (c) 2011 Trevor Burnham.** connect-coffee is based
# on the staticProvider module of Connect by Sencha Inc., and is freely
# distributable under the terms of the [MIT
# license](http://www.opensource.org/licenses/mit-license.php).

CoffeeScript = require 'coffee-script'
fs = require 'fs'
parseUrl = require('url').parse
path = require 'path'

# Map of request URLs to stored JavaScripts
cache = {}

module.exports = (root = process.cwd()) ->

  (req, res, next) ->
    console.log "req.url = #{req.url}"
    return next() unless req.method is 'GET' or req.method is 'HEAD'
    head = req.method is 'HEAD'
    url = parseUrl req.url
    filename = decodeURIComponent url.pathname
    return forbidden res if ~filename.indexOf '..'
    return next() unless filename.match /\.js/
    filename = path.join(root, filename).replace /\.js$/, '.coffee'
    console.log "filename = #{filename}"
    
    # Check the cache
    if !conditionalGET(req) and (hit = cache[req.url])
      res.writeHead 200, hit.headers
      res.end (if head then undefined else hit.body)
      return
    
    # Find out if a corresponding CoffeeScript file exists
    fs.stat filename, (err, stat) ->
      if err
        return if err.errno is process.ENOENT then next() else next(err)
      else if stat.isDirectory()
        return next()
      
      fs.readFile filename, 'utf8', (err, data) ->
        return next(err) if err
        
        compilerOptions = {}
        try
          js = CoffeeScript.compile data, compilerOptions
        catch compileErr
          return next(compileErr)

        headers =
          'Content-Type': 'application/javascript'
          'Content-Length': Buffer.byteLength js
          'Last-Modified': stat.mtime.toUTCString()
          'Cache-Control': "public max-age=0"
          'ETag': etag stat
      
        return notModified(res, headers) unless modified req, headers
      
        res.writeHead 200, headers
        res.end (if head then undefined else js)
      

# Given the request and the headers we intend to send, has the file been modified
# since the requester last received it?
modified = (req, headers) ->
  modifiedSince = req.headers['if-modified-since']
  lastModified = headers['Last-Modified']
  noneMatch = req.headers['if-none-match']
  etag = headers['ETag']
  
  if noneMatch and (noneMatch is etag)
    return false
  
  if modifiedSince and lastModified
    modifiedSinceDate = new Date(modifiedSince)
    lastModifiedDate = new Date(lastModified)
    if !isNaN(modifiedSinceDate.getTime())
      return false if lastModifiedDate <= modifiedSince
  
  true

# Checks if `req` is a conditional GET request
conditionalGET = (req) -> req.headers['if-modified-since'] or req.headers['if-none-match']

# Returns an etag of the form size-mtime
etag = (stat) -> "#{stat.size}-#{Number(stat.mtime)}"

# Sends a 304 response
notModified = (res, headers) ->
  for field of headers when field.indexOf 'Content' is 0
    delete headers[field]
  res.writeHead 304, headers
  res.end()
  return

# Sends a 403 error
forbidden = (res) ->
  body = 'Forbidden'
  res.writeHead 403,
    'Content-Type': 'text/plain'
    'Content-Length': body.length
  res.end body
  return

