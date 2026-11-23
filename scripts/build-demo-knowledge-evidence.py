"""Rebuild the read-only simulated QA index from the shipped demo source files."""
import hashlib
import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

base = Path(__file__).resolve().parents[1]
root = base / 'public/demo-inputs/v1'
records = []
for folder in ['presentation', 'timeline', 'story', 'component']:
    for path in sorted((root / folder).glob('*')):
        if path.suffix not in ['.docx', '.pptx', '.md']:
            continue
        chunks = []
        if path.suffix == '.md':
            chunks = [{'location': '需求正文', 'text': path.read_text()}]
        else:
            with zipfile.ZipFile(path) as archive:
                if path.suffix == '.pptx':
                    names = sorted((n for n in archive.namelist() if re.match(r'ppt/slides/slide\d+\.xml$', n)), key=lambda n: int(re.search(r'(\d+)\.xml', n)[1]))
                    chunks = [{'location': f'第 {index + 1} 页', 'text': '；'.join(e.text for e in ET.fromstring(archive.read(name)).iter() if e.tag.endswith('}t') and e.text)} for index, name in enumerate(names)]
                else:
                    paragraphs = [''.join(e.text for e in p.iter() if e.tag.endswith('}t') and e.text) for p in ET.fromstring(archive.read('word/document.xml')).iter() if p.tag.endswith('}p')]
                    chunks = [{'location': f'正文第 {i + 1} 段', 'text': text} for i, text in enumerate(paragraphs) if text and not text.startswith(('对应图片', '素材文件', '后续节点'))]
        records.append({'caseId': folder, 'name': path.name, 'path': path.name, 'url': '/demo-inputs/v1/' + folder + '/' + path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'chunks': chunks})
(base / 'src/domain/demo-knowledge-evidence.json').write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n')
