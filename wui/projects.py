
from .. import core
from .templating import TemplatingHandler
import json
import time
import tornado.web

def getProjectUrl(project):
    return '/p/' + project.idstr + '/' + project.ptype + '/'

def getProjectDict(project):
    return {
        'name': project.name,
        'idstr': project.idstr,
        'ptype': project.ptype,
        'baseurl': getProjectUrl(project)
    }

class _ProjectHandler(TemplatingHandler):
    def init(self, projectId):
        pm = self.application.project_manager
        try:
            p = pm[projectId]
        except KeyError:
            raise KeyError('project not found')

        self.p = p

        dct = getProjectDict(p)
        self.pdict = {'project': dct}

class ListProjectsHandler(TemplatingHandler):
    def get(self):
        pm = self.application.project_manager
        pdct = list(map(getProjectDict, pm))
        dct = {
            'projects': pdct,
            'template': 'projectlist',
            'title': 'Projects',
            'scripts': [{'src':'/static/projectlist.js'}]}
        self.render(dct)

class CreateProjectHandler(tornado.web.RequestHandler):
    def post(self):
        ptype = self.get_argument('ptype', None)
        assert ptype
        pname = self.get_argument('name', None)
        assert pname
        pm = self.application.project_manager
        p = pm.createReal(ptype, pname)
        pm.add(p)
        self.write({'url': getProjectUrl(p)})

