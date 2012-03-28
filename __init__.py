
import json
import os
import optparse
import webbrowser

from . import libs
libs.setupLibs()

import tornado
import tornado.ioloop
from . import wui
from . import core

def readOpts():
    parser = optparse.OptionParser(description='Censorship-resistant distributed collaboration')
    parser.add_option('-d', '--data-dir', dest='datadir', help='D2P data directory', default='~/.d2p', metavar='DIR')
    parser.add_option('--print-url', action='store_true', dest='print_url', help='Print URL of the web interface')
    parser.add_option('-w', '--start-webbrowser', action='store_true', dest='start_webbrowser', help='Start a webbrowser')
    parser.add_option('--start-webbrowser-new', dest='start_webbrowser_new', help='Start a webbrowser in a new "tab", "window", or in the "same" browser window', default="tab", metavar='tab|window|same')
    parser.add_option('--webui-port', dest='webui_port', help='Run the webbrowser on the specified port (0 for random)', metavar='PORT')
    parser.add_option('--webui-public', action='store_true', dest='webui_public', help='Serve to all IPs')
    opts,args = parser.parse_args()

    return opts

def _setupDatadir(opts):
    opts.datadir = os.path.expanduser(opts.datadir)

    if not os.path.exists(opts.datadir):
        os.mkdir(opts.datadir)
        os.mkdir(os.path.join(opts.datadir, 'projects'))
        with open(os.path.join(opts.datadir, 'config'), 'w') as configf:
            json.dump({}, configf)

def _readConfig(opts):
    cfg = {}
    with open(os.path.join(opts.datadir, 'config'), 'r') as cfgf:
        cfg.update(json.load(cfgf))
    cfg['_datadir'] = opts.datadir

    if opts.webui_port is not None:
        cfg.setdefault('web', {})['port'] = int(opts.webui_port)

    if opts.webui_public:
        cfg.setdefault('web', {})['addrs'] = ['::', '0.0.0.0']

    return cfg

def main():
    opts = readOpts()
    _setupDatadir(opts)
    cfg = _readConfig(opts)

    io_loop = tornado.ioloop.IOLoop()
    netCore = core.NetworkCore(io_loop, cfg)
    projectManager = core.ProjectManager(cfg, netCore)
    netCore.projectManager = projectManager

    ui = wui.WebUI(cfg, io_loop, projectManager, netCore)

    if opts.print_url:
        print(ui.getUrl())
    if opts.start_webbrowser:
        newWay = {
            'same': 0,
            'window': 1,
            'tab': 2,
        }[opts.start_webbrowser_new]
        webbrowser.open(ui.getUrl(), newWay)

    io_loop.start()

