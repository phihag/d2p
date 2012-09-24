
import base64
import collections
import hashlib
import io
import json
import os.path
import random
import struct
import time
from .cas import FilesystemCAS

def load(parentDir):
    with open(os.path.join(parentDir, 'projecttype'), 'r') as typef:
        ptype = typef.read()
    pclass = _ptypeMap[ptype]
    res = pclass.load(parentDir)
    assert res.ptype == ptype
    return res

def loadVirtualProject(parentDir):
    """ Load a project from a DTN medium """
    with open(os.path.join(parentDir, 'projecttype'), 'r') as typef:
        ptype = typef.read()
    pclass = _ptypeMapVirtual[ptype]
    return pclass.load(ptype, parentDir)


def createReal(netCore, parentDir, ptype, name):
    """ parentDir is the directory where the project and its database should be stored in """

    pcls = _ptypeMap[ptype]
    return pcls.createReal(netCore, parentDir, name)

def _genKeyPair():
    return (b'private key', b'public key ' + struct.pack('!I', random.SystemRandom().getrandbits(32)))

class Project(object):
    def __init__(self, name, publicKey, privateKey=None, secAlgorithm=None, netCore=None):
        """ netCore can be set later, but will be needed when the project is running """
        self._name = name
        self._privateKey = privateKey
        self._publicKey = publicKey
        if secAlgorithm is None:
            secAlgorithm = 'v0_sha256'
        assert secAlgorithm == 'v0_sha256'
        self._secAlgorithm = secAlgorithm
        self.netCore = netCore

        self._idstr_cache = hashlib.sha256(b'd2p-' + self._publicKey + self._secAlgorithm.encode('utf-8') + self.ptype.encode('utf-8')).hexdigest()

    def _netCore_set(self, val):
        self._netCore = val
        if val is not None:
            self._netCore.project_onLoad(self)
    netCore = property(fset=_netCore_set)

    @property
    def name(self):
        return self._name

    @property
    def idstr(self):
        return self._idstr_cache

    def save(self, sdir, initIfNotThere=False):
        if initIfNotThere:
            if not os.path.isdir(sdir):
                os.mkdir(sdir)
        else:
            assert os.path.isdir(sdir)

        with open(os.path.join(sdir, 'projecttype'), 'w') as typef:
            typef.write(self.ptype)

        header = {
            'name': self.name,
            'publicKey_b64': base64.b64encode(self._publicKey).decode('ASCII'),
            'secAlgorithm': self._secAlgorithm
        }
        with io.open(os.path.join(sdir, 'header'), 'w', encoding='utf-8') as headerf:
            json.dump(header, headerf)

        if self._privateKey:
            privateKeyFile = os.path.join(sdir, 'privateKey')
            if not os.path.exists(privateKeyFile):
                with open(privateKeyFile, 'wb') as privatekeyf:
                    privatekeyf.write(self._privateKey)

    @staticmethod
    def _def_load(sdir):
        with io.open(os.path.join(sdir, 'header'), 'r', encoding='utf-8') as headerf:
            header = json.load(headerf)

        privateKey = None
        privateKeyFile = os.path.join(sdir, 'privateKey')
        if os.path.exists(privateKeyFile):
            with open(privateKeyFile, 'rb') as privatekeyf:
                privateKey = privatekeyf.read()

        publicKey = base64.b64decode(header['publicKey_b64'].encode('ASCII'))

        return (header['name'], publicKey, privateKey, header['secAlgorithm'])

class CASBasedProject(Project):
    def __init__(self, name, publicKey, privateKey=None, secAlgorithm=None, netCore=None, cas=None):
        """ cas is the backing CAS for this project. It can be set immediately after creation, but not any later. """
        super(CASBasedProject, self).__init__(name, publicKey, privateKey=privateKey, secAlgorithm=secAlgorithm, netCore=netCore)
        self.cas = cas

    def _cas_set(self, cas):
        self._cas = cas
        if cas is not None:
            self._initAppDB()
    cas = property(fset=_cas_set)

    @property
    def ui_cas(self):
        return self._cas

    def _initAppDB(self):
        """ Initializes the application database from the CAS. """
        for k in self._cas:
            self._onNewBlock(k, self._cas[k], initialLoad=True)

    def _onNewBlock(self, blockId, block, initialLoad=False):
        """ Called when a new block is added to the CAS """
        if not initialLoad:
            self._netCore.broadcast(self.idstr, {
                'mtype': 'newBlock',
                'blockId': blockId,
            })

    def makeVProject(self, parentDir):
        res = VirtualCASBasedProject(self.ptype, self._name, self._publicKey, privateKey=None, netCore=None, secAlgorithm=self._secAlgorithm)
        projectDir = os.path.join(parentDir, res.idstr)
        res.save(projectDir, initIfNotThere=True)
        cas = FilesystemCAS(os.path.join(projectDir, 'cas'))
        cas.load(initIfNotThere=True)
        res.cas = cas
        return res

    def makeRProject(self, parentDir):
        cls = _ptypeMap[self.ptype]
        res = cls(self._name, self._publicKey, privateKey=None, netCore=None, secAlgorithm=self._secAlgorithm)
        projectDir = os.path.join(parentDir, res.idstr)
        res.save(projectDir, initIfNotThere=True)
        cas = FilesystemCAS(os.path.join(projectDir, 'cas'))
        cas.load(initIfNotThere=True)
        res.cas = cas
        return res

    def answerQuery(self, q):
        if q['qtype'] == 'listRoot':
            return {
                'atype': 'listRoot',
                'root': list(self._cas)
            }
        elif q['qtype'] == 'getBlock':
            block = self._cas[q['blockId']]
            return {
                'atype': 'getBlock',
                'block': base64.b64encode(block).decode('ASCII')
            }
        else:
            raise NotImplementedError()

    def handleMessage(self, ep, msg):
        if msg['mtype'] == 'newBlock':
            blockId = msg['blockId']
            assert isinstance(blockId, str)
            if blockId not in self._cas:
                self._netCore.query(ep, self.idstr, {
                    'qtype': 'getBlock',
                    'blockId': blockId
                }, self._onBlockResult)
        else:
            raise NotImplementedError()

    def _onBlockResult(self, ep, bsResult):
        assert bsResult['atype'] == 'getBlock'
        block = base64.b64decode(bsResult['block'].encode('ASCII'))
        assert isinstance(block, bytes)
        blockId = self._cas.add_new(block)
        if blockId: # New block
            self._onNewBlock(blockId, block)

    def handleEndpoint(self, ep):
        def _onAnswer(ep, answer):
            assert len(answer['root']) >= 0
            for bid in answer['root']:
                if bid not in self._cas:
                    self._netCore.query(ep, self.idstr, {
                        'qtype': 'getBlock',
                        'blockId': bid
                    }, self._onBlockResult)

        self._netCore.query(ep, self.idstr, {
            'qtype': 'listRoot',
        }, _onAnswer)

class VirtualCASBasedProject(CASBasedProject):
    def __init__(self, ptype, name, publicKey, privateKey=None, netCore=None, secAlgorithm=None, cas=None):
        self.ptype = ptype
        super(VirtualCASBasedProject, self).__init__(name, publicKey, privateKey=privateKey, secAlgorithm=secAlgorithm, cas=cas)

    @staticmethod
    def load(ptype, projectDir):
        pargs = Project._def_load(projectDir)
        res = VirtualCASBasedProject(ptype, *pargs)
        cas = FilesystemCAS(os.path.join(projectDir, 'cas'))
        cas.load(initIfNotThere=False)
        res.cas = cas
        return res

class DocDBProject(CASBasedProject):
    def __init__(self, *args, **kwargs):
        self._db = {}
        super(DocDBProject, self).__init__(*args, **kwargs)

    def serialize(self, o):
        assert isinstance(o, dict)
        res = json.dumps(o, sort_keys=True).encode('utf-8')
        assert isinstance(res, bytes)
        return res

    def unserialize(self, bs):
        assert isinstance(bs, bytes)
        bs_str = bs.decode('UTF-8')
        return json.loads(bs_str)

    def _onNewBlock(self, blockId, block, initialLoad=False):
        super(DocDBProject, self)._onNewBlock(blockId, block, initialLoad)
        data = self.unserialize(block)
        assert '_id' in data
        assert '_rev' in data
        allVersions = self._db.setdefault(data['_id'], {})
        allVersions[data['_rev']] = data

    def allNewest(self):
        for e in self._db.values():
            allRevisions = list(e.keys())
            doc = e[max(allRevisions, key=int)].copy()
            doc['_all_revisions'] = allRevisions
            yield doc

    def view_newest(self, viewf):
        return filter(viewf, self.allNewest())

    def getEntry(self, eid, eversion=None, includeRevisionIds=False):
        entryData = self._db[eid]
        if eversion is None:
            eversion = max(entryData.keys(), key=int)
        res = entryData[eversion]
        if includeRevisionIds:
            res = res.copy()
            res['_revisionIds'] = list(sorted(entryData.keys(), key=int))
        return res

    def local_add(self, data):
        _ALLOWED_UNDERSCORES = ['_id', '_rev']
        for k in data:
            if k in _ALLOWED_UNDERSCORES:
                continue
            if k.startswith('_'):
                raise ValueError('Reserved key ' + repr(k) + ' in local data input')

        if '_id' not in data:
            data['_id'] = hashlib.sha256(self.serialize(data)).hexdigest()
        if '_rev' not in data:
            data['_rev'] = str(int(time.time()))

        block = self.serialize(data)
        blockId = self._cas.add_new(block)
        if blockId:
            self._onNewBlock(blockId, block, initialLoad=False)
        return data

class CoopNormsProject(DocDBProject):
    ptype = 'cono'

    @classmethod
    def create(cls, name, cas=None):
        privKey,pubKey = _genKeyPair()
        res = cls(name, pubKey, privKey, cas=cas)
        return res

    @classmethod
    def createReal(cls, netCore, parentDir, name):
        res = cls.create(name)
        projectDir = os.path.join(parentDir, res.idstr)
        res.save(projectDir, initIfNotThere=True)
        cas = FilesystemCAS(os.path.join(projectDir, 'cas'))
        cas.load(initIfNotThere=True)
        res.cas = cas
        res.netCore = netCore
        return res

    @classmethod
    def load(cls, projectDir):
        pargs = Project._def_load(projectDir)
        res = cls(*pargs)
        cas = FilesystemCAS(os.path.join(projectDir, 'cas'))
        cas.load(initIfNotThere=False)
        res.cas = cas
        res._initAppDB()
        return res

class LectureProject(DocDBProject):
    ptype = 'lecture'

    @classmethod
    def create(cls, name, cas=None):
        privKey,pubKey = _genKeyPair()
        res = cls(name, pubKey, privKey, cas=cas)
        return res

    @classmethod
    def createReal(cls, netCore, parentDir, name):
        res = cls.create(name)
        projectDir = os.path.join(parentDir, res.idstr)
        res.save(projectDir, initIfNotThere=True)
        cas = FilesystemCAS(os.path.join(projectDir, 'cas'))
        cas.load(initIfNotThere=True)
        res.cas = cas
        res.netCore = netCore
        return res

    @classmethod
    def load(cls, projectDir):
        pargs = Project._def_load(projectDir)
        res = cls(*pargs)
        cas = FilesystemCAS(os.path.join(projectDir, 'cas'))
        cas.load(initIfNotThere=False)
        res.cas = cas
        res._initAppDB()
        return res
   

_ptypeMap = {
    CoopNormsProject.ptype: CoopNormsProject,
    LectureProject.ptype: LectureProject,
}

_ptypeMapVirtual = {
    CoopNormsProject.ptype: VirtualCASBasedProject
}
