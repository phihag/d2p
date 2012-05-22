import re

def sortkey_natural(s):
    return tuple(int(part) if part.isdecimal() else part
                for part in re.split(r'([0-9]+)', s))

