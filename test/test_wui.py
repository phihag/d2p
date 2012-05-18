#!/usr/bin/env python3

import setup_tests
import unittest

import d2p.wui.templating    

class TestWUI(unittest.TestCase):
    def test_templating_parseAccept(self):
        self.assertEqual(d2p.wui.templating._parseAccept('a/b'), ['a/b'])
        # Stability is not required by the RFC, but de facto usage
        self.assertEqual(d2p.wui.templating._parseAccept('a/b,c/d'), ['a/b','c/d'])
        self.assertEqual(d2p.wui.templating._parseAccept('a/b;xa=yaa'), ['a/b;xa=yaa'])
        self.assertEqual(d2p.wui.templating._parseAccept('a/b;x=y;z=,c/d;q=0.5,e/f;q=0.5,g/h;q=0.6'),
                          ['a/b;x=y;z=', 'g/h', 'c/d', 'e/f'])
        self.assertEqual(d2p.wui.templating._parseAccept('a/b,c/d;q=0.8,e/f;q=0.9;q=0.7,g/h'),
                          ['a/b', 'g/h', 'e/f;q=0.7', 'c/d'])
        self.assertEqual(d2p.wui.templating._parseAccept('text/*,*/*'), ['text/*', '*/*'])

    def test_templating_findMatch(self):
        self.assertEqual(d2p.wui.templating._findMime('a/b,c/d', ['c/d', 'e/f', 'a/b']), 'a/b')
        self.assertEqual(d2p.wui.templating._findMime('a/b;q=0.9,c/d', ['a/b', 'c/d']), 'c/d')
        self.assertEqual(d2p.wui.templating._findMime('a/b,e/*', ['c/d', 'e/f']), 'e/f')
        self.assertEqual(d2p.wui.templating._findMime(None, ['c/d', 'e/f']), 'c/d')
        self.assertRaises(KeyError, d2p.wui.templating._findMime, 'a/b', ['c/d'])
        self.assertEqual(d2p.wui.templating._findMime('a/b,*/*;q=0.5', ['c/d']), 'c/d')
        self.assertEqual(d2p.wui.templating._findMime(None, ['c/d', 'e/f'], default='e/f'), 'e/f')
        self.assertEqual(d2p.wui.templating._findMime('x/y,*/*', ['c/d', 'e/f'], default='e/f'), 'e/f')

if __name__ == '__main__':
    unittest.main()
