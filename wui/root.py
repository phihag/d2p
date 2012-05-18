
import glob
import json
import os
import socket
import tornado.web
from . import templating

class RootHandler(tornado.web.RequestHandler):
    def get(self):
        self.redirect('/p/')

class ManifestHandler(tornado.web.RequestHandler):
    def initialize(self, staticFileInfo=None, templateFileInfo=None):
        assert staticFileInfo
        self._staticFileInfo = staticFileInfo
        assert templateFileInfo
        self._templateFileInfo = templateFileInfo

    def get(self):
        raise ValueError('TODO: disabled for now, will need CHROMIUM-INTERCEPT style')
        self.set_header('Content-Type', 'text/cache-manifest')
        self.write(self.getManifest())

    def _getFilesInfo(self, files):
        """
        Yields tupels (url-path, filepath) for all files
        """
        assert os.path.sep == '/'
        for urlPrefix, pathPrefix, filePatterns in files:
            for fp in filePatterns:
                fullPattern = os.path.join(pathPrefix, fp)
                for filePath in glob.glob(fullPattern):
                    urlPath = urlPrefix + filePath[len(pathPrefix)+len(os.sep):]
                    yield (urlPath, filePath)

    def getManifest(self):
        res = 'CACHE MANIFEST\n\n'
        res += 'CACHE:\n\n'
        res += '/' + '\n\n'
        for urlPath,filePath in self._getFilesInfo(self._staticFileInfo):
            fileVersionId = str(os.stat(filePath).st_mtime)
            res += urlPath + '\n'
            res += '# mtime ' + fileVersionId + '\n\n'
        for urlPath,filePath in self._getFilesInfo(self._templateFileInfo):
            fileVersionId = str(os.stat(filePath).st_mtime)
            res += '#' + urlPath + '\n'
            res += '# mtime ' + fileVersionId + '\n\n'
        res += 'NETWORK:\n*\n'

        return res
