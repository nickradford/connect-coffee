(function() {
  var CoffeeScript, cache, conditionalGET, etag, forbidden, fs, modified, notModified, parseUrl, path;
  CoffeeScript = require('coffee-script');
  fs = require('fs');
  parseUrl = require('url').parse;
  path = require('path');
  cache = {};
  module.exports = function(root) {
    if (root == null) {
      root = process.cwd();
    }
    return function(req, res, next) {
      var filename, head, hit, url;
      console.log("req.url = " + req.url);
      if (!(req.method === 'GET' || req.method === 'HEAD')) {
        return next();
      }
      head = req.method === 'HEAD';
      url = parseUrl(req.url);
      filename = decodeURIComponent(url.pathname);
      if (~filename.indexOf('..')) {
        return forbidden(res);
      }
      if (!filename.match(/\.js/)) {
        return next();
      }
      filename = path.join(root, filename).replace(/\.js$/, '.coffee');
      console.log("filename = " + filename);
      if (!conditionalGET(req) && (hit = cache[req.url])) {
        res.writeHead(200, hit.headers);
        res.end((head ? void 0 : hit.body));
        return;
      }
      return fs.stat(filename, function(err, stat) {
        if (err) {
          if (err.errno === process.ENOENT) {
            return next();
          } else {
            return next(err);
          }
        } else if (stat.isDirectory()) {
          return next();
        }
        return fs.readFile(filename, 'utf8', function(err, data) {
          var compilerOptions, headers, js;
          if (err) {
            return next(err);
          }
          compilerOptions = {};
          try {
            js = CoffeeScript.compile(data, compilerOptions);
          } catch (compileErr) {
            return next(compileErr);
          }
          headers = {
            'Content-Type': 'application/javascript',
            'Content-Length': Buffer.byteLength(js),
            'Last-Modified': stat.mtime.toUTCString(),
            'Cache-Control': "public max-age=0",
            'ETag': etag(stat)
          };
          if (!modified(req, headers)) {
            return notModified(res, headers);
          }
          res.writeHead(200, headers);
          return res.end((head ? void 0 : js));
        });
      });
    };
  };
  modified = function(req, headers) {
    var etag, lastModified, lastModifiedDate, modifiedSince, modifiedSinceDate, noneMatch;
    modifiedSince = req.headers['if-modified-since'];
    lastModified = headers['Last-Modified'];
    noneMatch = req.headers['if-none-match'];
    etag = headers['ETag'];
    if (noneMatch && (noneMatch === etag)) {
      return false;
    }
    if (modifiedSince && lastModified) {
      modifiedSinceDate = new Date(modifiedSince);
      lastModifiedDate = new Date(lastModified);
      if (!isNaN(modifiedSinceDate.getTime())) {
        if (lastModifiedDate <= modifiedSince) {
          return false;
        }
      }
    }
    return true;
  };
  conditionalGET = function(req) {
    return req.headers['if-modified-since'] || req.headers['if-none-match'];
  };
  etag = function(stat) {
    return "" + stat.size + "-" + (Number(stat.mtime));
  };
  notModified = function(res, headers) {
    var field;
    for (field in headers) {
      if (field.indexOf('Content' === 0)) {
        delete headers[field];
      }
    }
    res.writeHead(304, headers);
    res.end();
  };
  forbidden = function(res) {
    var body;
    body = 'Forbidden';
    res.writeHead(403, {
      'Content-Type': 'text/plain',
      'Content-Length': body.length
    });
    res.end(body);
  };
}).call(this);
