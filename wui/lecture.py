from .projects import _ProjectHandler

class _LectureProjectHandler(_ProjectHandler):
    def init(self, projectId):
        super(_LectureProjectHandler, self).init(projectId)
        assert self.p.ptype == 'lecture'
        self.pdict['hideHeader'] = True

class LectureProjectShowHandler(_LectureProjectHandler):
    def get(self, projectId):
        self.init(projectId)

        dct = self.pdict
        dct['template'] = 'lecture/show'
        dct['title'] = self.p.name
        dct['tracks'] = list(self.p.view_newest(lambda e: e['type'] == 'track'))
        self.render(dct)

def routes(prefix):
    return [
        (prefix + r"/", LectureProjectShowHandler),
    ]

