#!/usr/bin/env python3
"""Standard-library verification of the published scientific data contract.
Run beside a copied data/ tree; no internet, credentials or package install needed.
"""
import argparse, hashlib, json, pathlib, sys
parser=argparse.ArgumentParser()
parser.add_argument('--root',type=pathlib.Path,default=pathlib.Path(__file__).resolve().parent.parent,help='Directory containing data/ and research-core/')
args=parser.parse_args();root=args.root.resolve()
catalog=json.loads((root/'research-core/catalog.json').read_text(encoding='utf-8'))
errors=[];ids=set()
for entry in catalog['datasets']:
    ident=entry['id'];path=(root/entry['path']).resolve()
    if ident in ids:errors.append('Duplicate id: '+ident)
    ids.add(ident)
    if not path.is_relative_to(root):errors.append('Path escapes root: '+entry['path']);continue
    if not path.is_file():errors.append('Missing: '+entry['path']);continue
    if hashlib.sha256(path.read_bytes()).hexdigest()!=entry['sha256']:errors.append('Changed scientific/published source: '+entry['path'])
    try:json.loads(path.read_text(encoding='utf-8'))
    except (ValueError,UnicodeDecodeError) as exc:errors.append('Unreadable JSON: '+entry['path'])
for mapping in catalog.get('evidence_bindings',[]):
    for ident in mapping.get('dataset_ids',[]):
        if ident not in ids:errors.append('Unknown bound dataset: '+ident)
for ref in catalog.get('separate_recipe_refs',[]):
    if not (root/ref['path']).is_file():errors.append('Missing separate recipe: '+ref['path'])
result={'pass':not errors,'dataset_count':len(ids),'evidence_bindings':len(catalog.get('evidence_bindings',[])),'errors':errors,'scope':'Integrity, paths and JSON readability only; not a new scientific validation or visual acceptance.'}
print(json.dumps(result,ensure_ascii=False,indent=2));sys.exit(bool(errors))
