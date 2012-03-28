import binascii
import hashlib
import os.path

class CAS(object):
    def hash(self, content):
        assert isinstance(content, bytes)
        res = hashlib.sha256(content).hexdigest()
        return res

class FilesystemCAS(CAS):
    def __init__(self, basepath):
        """ You will probably want to call load afterwards """
        self._d = {}
        self._basepath = basepath

    def __getitem__(self, addr):
        """ Throws a KeyError if the value is not stored in the CAS """
        assert isinstance(addr, str)
        return self._d[addr]

    def __iter__(self):
        return iter(self._d.keys())

    def add(self, content):
        addr = self.hash(content)
        with open(os.path.join(self._basepath, addr + '.block'), 'wb') as f:
            f.write(content)
        self._d[addr] = content

    def add_new(self, content):
        """ Returns None iff the content is already present, the Id otherwise """
        addr = self.hash(content)
        if addr in self._d:
            return None
        else:
            self.add(content)
            return addr

    def load(self, initIfNotThere=False):
        if initIfNotThere:
            if not os.path.isdir(self._basepath):
                os.mkdir(self._basepath)
        else:
            assert os.path.isdir(self._basepath)

        for fn in os.listdir(self._basepath):
            addr,_,ext = fn.partition('.')
            if ext != 'block':
                continue

            with open(os.path.join(self._basepath, fn), 'rb') as f:
                content = f.read()
            assert addr == self.hash(content)
            self._d[addr] = content
