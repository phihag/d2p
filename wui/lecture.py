import json
import os.path
from .projects import _ProjectHandler

import d2p.util
import d2p.wui.templating

class _LectureProjectHandler(_ProjectHandler):
    def init(self, projectId):
        super(_LectureProjectHandler, self).init(projectId)
        assert self.p.ptype == 'lecture'
        self.pdict['hideHeader'] = True
        self.pdict['showUI'] = True
        self.pdict.setdefault('scripts', []).extend([
            {'src': '/static/lecture/lecture.js'},
            {'src': '/static/lecture_admin.js'},
        ])
        self.pdict.setdefault('stylesheets', []).extend([
            {'src': '/static/lecture/lecture.css'},
        ])

    def genChapterUrl(self, chapterId):
        return self.pdict['project']['baseurl'] + 'chapter/' + chapterId + '/'

    def getChapters(self):
        return sorted(self.p.view_newest(lambda e: e['type'] == 'chapter'), key=lambda e: d2p.util.sortkey_natural(e['name']))

    def getLectureTemplates(self):
        templateDir = os.path.join(d2p.wui.templating.TEMPLATE_PATH, 'lecture')
        res = {}
        for fn in os.listdir(templateDir):
            if fn.startswith('_'):
                continue
            base,ext = os.path.splitext(fn)
            if ext != '.mustache':
                continue
            with open(os.path.join(templateDir, fn)) as f:
                res[base] = f.read()
        return res

class LectureProjectShowHandler(_LectureProjectHandler):
    def get(self, projectId):
        self.init(projectId)

        dct = self.pdict
        dct['template'] = 'lecture/overview'
        dct['title'] = self.p.name
        dct['chapters'] = self.getChapters()
        for c in dct['chapters']:
            c['_url'] = self.genChapterUrl(c['_id'])
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
        return self.genChapterUrl(eId)

    def get(self, projectId, eId, revId=None):
        self.init(projectId)

        dct = self.pdict
        e = self.p.getEntry(eId, revId)
        dct['template'] = 'lecture/chapter-javascript'
        dct['title'] = e['name'] + ' - ' + self.p.name
        e['_slides'] = list(self.p.view_newest(lambda e: e['type'] == 'slide' and e.get('chapter') == eId))
        e['_lectureName'] = self.pdict['project']['name']
        dct['chapter'] = e
        dct['chapterJSON'] = json.dumps(e, indent=4)
        dct['templatesJSON'] = json.dumps(self.getLectureTemplates())
        self.render(dct)


def routes(prefix):
    return [
        (prefix + r"/", LectureProjectShowHandler),
        (prefix + r"/chapter/", ChapterHandler),
        (prefix + r"/chapter/([0-9a-f]+)/", ChapterHandler),
        (prefix + r"/chapter/([0-9a-f]+)@([0-9a-f]+)/", ChapterHandler),
    ]

