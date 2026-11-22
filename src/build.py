# Rebuild ../index.html from src.html + engine.js:  python3 src/build.py
import os
d = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(d, 'src.html')).read()
eng = open(os.path.join(d, 'engine.js')).read()
open(os.path.join(d, '..', 'index.html'), 'w').write(src.replace('/*ENGINE*/', eng))
print('built index.html')
