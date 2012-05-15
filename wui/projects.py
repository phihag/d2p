
from .. import core
from .templating import TemplatingHandler
import json
import time
import tornado.web

class _ProjectHandler(TemplatingHandler):
    def init(self, projectId):
        pm = self.application.project_manager
        try:
            p = pm[projectId]
        except KeyError:
            raise KeyError('project not found')

        self.p = p

        dct = {'name': p.name, 'idstr': p.idstr, 'ptype': p.ptype, 'baseurl': self.getProjectUrl(p)}
        self.pdict = {'project': dct}

    def getProjectUrl(self, project):
        return '/p/' + project.idstr + '/' + project.ptype + '/'

class ListProjectsHandler(TemplatingHandler):
    def get(self):
        pm = self.application.project_manager
        pdct = [{'idstr': p.idstr, 'name': p.name, 'ptype': p.ptype} for p in pm]
        dct = {'projects': pdct}
        dct['template'] = 'projectlist'
        dct['title'] = 'Projects'
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
        self.write({'url': self.getProjectUrl(p)})

