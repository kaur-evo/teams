"""Independently re-derives the migration from the source and checks the
workbook against it. Written to disagree with the builder, not to mirror it:
every expected value here is recomputed from the CSV rather than imported."""
import csv, collections, sys, re
from openpyxl import load_workbook

SRC='operators_data_202608141724-noname.csv'; XL='operator-group-migration.xlsx'
DROP_PREFIX='IT-AGR-'; DROP_FACTORY='IT-Agribios'
fails=[]
def check(name, ok, detail=''):
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + ('' if ok else f"\n      {detail}"))
    if not ok: fails.append(name)

sp=lambda v:[x.strip() for x in (v or '').split(',') if x.strip()]

# ---- rebuild expectation from source ----
src={}
with open(SRC,encoding='utf-8-sig') as fh:
    rd=csv.reader(fh,delimiter=';'); hdr=next(rd)
    for c in rd:
        if not c or not c[0]: continue
        src[(c[0],c[1])]={'stations':sp(c[4]),'factories':sp(c[5]),'factoryCount':c[6]}

exp={}
for (t,oid),v in src.items():
    st,fa=list(v['stations']),list(v['factories'])
    if t=='yara' and DROP_FACTORY in fa:
        st=[s for s in st if not s.startswith(DROP_PREFIX)]
        fa=[f for f in fa if f!=DROP_FACTORY]
    fa=sorted(set(fa))
    exp[(t,oid)]={'stations':st,'factories':fa,'group':', '.join(fa) if st else ''}

wb=load_workbook(XL, read_only=True)
check('Workbook has exactly 3 sheets', wb.sheetnames==['Operators','Groups','Summary'], wb.sheetnames)

# ---- sheet 1 ----
ws=wb['Operators']; rows=list(ws.values); head=list(rows[0]); body=rows[1:]
check('Operators header as expected',
      head==['tenantName','operatorId','stations','factories','factoryCount','operatorGroup','note'], head)
check('Operators row count equals source', len(body)==len(src), f'{len(body)} vs {len(src)}')

keys=[(r[0],str(r[1])) for r in body]
check('No duplicate operator rows', len(keys)==len(set(keys)),
      f'{len(keys)-len(set(keys))} duplicates')
check('Every source operator present', set(keys)==set(src.keys()),
      f'missing {len(set(src)-set(keys))}, extra {len(set(keys)-set(src))}')

bad_group=bad_st=bad_fc=bad_blank=0
for r in body:
    k=(r[0],str(r[1])); e=exp.get(k)
    if not e: continue
    if (r[5] or '')!=e['group']: bad_group+=1
    if sp(r[2])!=e['stations']: bad_st+=1
    if int(r[4] or 0)!=len(e['factories']): bad_fc+=1
    if not e['stations'] and (r[5] or ''): bad_blank+=1
check('operatorGroup matches recomputed factories', bad_group==0, f'{bad_group} rows differ')
check('stations match after the Yara removal', bad_st==0, f'{bad_st} rows differ')
check('factoryCount equals number of factories listed', bad_fc==0, f'{bad_fc} rows differ')
check('Operators with no stations have no group', bad_blank==0, f'{bad_blank} rows have a group')

# ---- privacy ----
leak=[c for c in head if re.search(r'name', c, re.I) and c!='tenantName']
check('No operator-name column', not leak, leak)
srcnames=set()
with open(SRC,encoding='utf-8-sig') as fh:
    if 'firstName' in fh.readline(): srcnames.add('firstName')
check('Source itself carries no names', not srcnames, srcnames)

# ---- Yara ----
y=[r for r in body if r[0]=='yara']
check('No IT-AGR- station remains in yara',
      not any(s.startswith(DROP_PREFIX) for r in y for s in sp(r[2])))
check('No IT-Agribios factory remains in yara',
      not any(f==DROP_FACTORY for r in y for f in sp(r[3])))
check('No yara group name mentions IT-Agribios',
      not any(DROP_FACTORY in (r[5] or '') for r in y))
untouched=[k for k in src if k[0]!='yara']
diff=sum(1 for k in untouched
         if sp(dict(zip(head,next(r for r in body if (r[0],str(r[1]))==k)))['stations'])!=src[k]['stations'])
check('Non-yara stations untouched', diff==0, f'{diff} changed')

# ---- sheet 2 ----
ws2=wb['Groups']; g=list(ws2.values); ghead=list(g[0]); gbody=g[1:]
check('Groups header as expected', ghead==['tenantName','operatorGroup','operators'], ghead)
want=collections.Counter((r[0],r[5]) for r in body if r[5])
got={(r[0],r[1]):r[2] for r in gbody}
check('No duplicate tenant+group rows', len(gbody)==len(got), f'{len(gbody)-len(got)} duplicates')
check('Groups sheet lists every distinct group', set(got)==set(want),
      f'missing {len(set(want)-set(got))}, extra {len(set(got)-set(want))}')
check('Operator counts per group are correct',
      all(got.get(k)==v for k,v in want.items()),
      str([k for k,v in want.items() if got.get(k)!=v][:3]))
check('Group operator counts sum to grouped operators',
      sum(got.values())==sum(1 for r in body if r[5]),
      f'{sum(got.values())} vs {sum(1 for r in body if r[5])}')
check('No blank group name on Groups sheet', all(r[1] for r in gbody))

# ---- sheet 3 ----
s=dict()
for r in wb['Summary'].values:
    if r[0] and r[1] not in (None,''): s[r[0]]=r[1]
def num(label): return s.get(label)
check('Summary: source row count', num('Operator rows in source')==len(src), num('Operator rows in source'))
check('Summary: operators receiving a group',
      num('Operators receiving a group')==sum(1 for r in body if r[5]))
check('Summary: groups to create', num('Groups to create')==len(want))
check('Summary: tenants receiving groups',
      num('Tenants receiving groups')==len(set(t for t,_ in want)))
check('Summary: total without a group',
      num('Total without a group')==sum(1 for r in body if not r[5]))
check('Summary: no-group parts add up',
      (num('  had no stations in the source') or 0)+(num('  emptied by the Yara change') or 0)
      ==num('Total without a group'))
check('Summary: yara operators touched',
      num('Operators touched')==sum(1 for k,v in src.items()
                                    if k[0]=='yara' and DROP_FACTORY in v['factories']))
check('Summary: yara groups after', num('Yara groups after')==sum(1 for t,_ in want if t=='yara'))
pt=collections.Counter(t for t,_ in want)
check('Summary: max groups per tenant', num('Maximum')==max(pt.values()), num('Maximum'))
check('Summary: tenants with exactly 1 group',
      num('Tenants with exactly 1 group')==sum(1 for v in pt.values() if v==1))
check('Summary: average groups per tenant',
      abs(num('Average')-sum(pt.values())/len(pt))<0.01, num('Average'))

print('\n' + (f'{len(fails)} FAILED: '+', '.join(fails) if fails else 'All checks passed.'))
sys.exit(1 if fails else 0)
