
import distutils.util
import os.path
import sys

_ROOTDIR = os.path.dirname(os.path.abspath(__file__))

def setupLibs():
    if sys.version_info[0] == 2:
        plat_specifier = ".%s-%s" % (distutils.util.get_platform(), sys.version[0:3])
        sys.path.append(os.path.join(_ROOTDIR, 'libs', 'tornado', 'build', 'lib' + plat_specifier))
    else:
        sys.path.append(os.path.join(_ROOTDIR, 'libs', 'tornado', 'build', 'lib'))
    sys.path.append(os.path.join(_ROOTDIR, 'libs', 'py3stache'))

