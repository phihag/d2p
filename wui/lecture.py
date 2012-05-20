from .projects import _ProjectHandler

class _LectureProjectHandler(_ProjectHandler):
    def init(self, projectId):
        super(_LectureProjectHandler, self).init(projectId)
        assert self.p.ptype == 'lecture'
        self.pdict['hideHeader'] = True
        self.pdict['showUI'] = True
        self.pdict.get('scripts', []).extend([
            {'src': '/static/lecture.js'},
            {'src': '/static/lecture_admin.js'},
        ])

class LectureProjectShowHandler(_LectureProjectHandler):
    def get(self, projectId):
        self.init(projectId)

        dct = self.pdict
        dct['template'] = 'lecture/overview'
        dct['title'] = self.p.name
        dct['chapters'] = list(self.p.view_newest(lambda e: e['type'] == 'chapter'))
        self.render(dct)

class _LectureCRUDHandler(_LectureProjectHandler):
    """ Subclasses must implement genUrl, and set _TYPE and _KEYS """

    def post(self, projectId, eId=None): # None: new entry
        self.init(projectId)

        d = {
            'type': self._TYPE
        }
        for k in self._KEYS:
            v = self.get_argument(k, None)
            assert v
            d[k] = v

        if eId:
            d['_id'] = eId

        e = self.p.local_add(d)

        dct = self.pdict
        dct['url'] = self.genUrl(e['_id'])
        self.write(dct)

class ChapterHandler(_LectureCRUDHandler):
    _KEYS = ['name']
    _TYPE = 'chapter'
    def genUrl(self, eId):
        return self.pdict['project']['baseurl'] + 'chapter/' + eId + '/'

    def get(self, projectId, eId, revId=None):
        self.init(projectId)

        dct = self.pdict
        e = self.p.getEntry(eId, revId)
        dct['template'] = 'lecture/chapter'
        dct['title'] = e['name'] + ' - ' + self.p.name
        dct['chapter'] = e
        dct['chapter']['slides'] = list(self.p.view_newest(lambda e: e.get('chapter') == eId))
        self.render(dct)



def routes(prefix):
    return [
        (prefix + r"/", LectureProjectShowHandler),
        (prefix + r"/chapter/", ChapterHandler),
        (prefix + r"/chapter/([0-9a-f]+)/", ChapterHandler),
        (prefix + r"/chapter/([0-9a-f]+)@([0-9a-f]+)/", ChapterHandler),
    ]

