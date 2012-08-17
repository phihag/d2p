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
            {'src': '/static/lecture/mustache.js'},
            {'src': '/static/lecture/osxh.js'},
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
                res['lecture/' + base] = f.read()
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

class ChapterHandler(_LectureProjectHandler):
    def post(self, projectId, eId=None): # None: new entry
        self.init(projectId)

        d = {
            'type': 'chapter'
        }
        for k in ['name']:
            v = self.get_argument(k, None)
            assert v
            d[k] = v
        slidesJSON = self.get_argument('slidesJSON', None)
        if not slidesJSON:
            slidesJSON = '[]'
        d['slides'] = json.loads(slidesJSON)
        assert isinstance(d['slides'], list)

        if eId:
            d['_id'] = eId

        e = self.p.local_add(d)

        dct = self.pdict
        dct['url'] = self.genChapterUrl(e['_id'])
        self.write(dct)


    def get(self, projectId, eId, revId=None):
        self.init(projectId)

        dct = self.pdict
        e = self.p.getEntry(eId, revId)
        dct['template'] = 'lecture/chapter-javascript'
        dct['title'] = e['name'] + ' - ' + self.p.name
        e['_lecture'] = self.pdict['project']
        dct['chapter'] = e
        dct['chapterJSON'] = json.dumps(e, indent=4)
        dct['templatesJSON'] = json.dumps(self.getLectureTemplates())
        self.render(dct)


def routes(prefix):
    return [
        (prefix + r"/", LectureProjectShowHandler),
        (prefix + r"/chapter/", ChapterHandler),
        (prefix + r"/chapter/([0-9a-f]+)/", ChapterHandler),
    ]

