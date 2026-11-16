from pathlib import Path
from bs4 import BeautifulSoup
p=Path('/mnt/data/temgogo_v19_work')
html=(p/'index.html').read_text()
s=BeautifulSoup(html,'html.parser')
# Host: preflight appears inside TV video frame and keeps QR and controls visible
pre=s.find(id='stage-preflight'); frame=s.find(id='video-frame');frame.append(pre.extract())
intro=pre.find(class_='diva-preflight-intro')
label=intro.find(class_='preflight-heading');label.string='👑 TODOS NO CAMARIM'
next_title=s.new_tag('h2',id='tg19-next-singer');next_title['class']='tg19-next-singer';next_title.string='VOCÊ É O PRÓXIMO!'
intro.find('div').insert(1,next_title)
# clean host repeated status; keep single compact status strip
stage=s.find(id='stage');stage.find(id='stage-command-participants')['hidden']=''
box=stage.find(id='stage-command');box['aria-label']='Resumo compacto da festa'
solo=stage.find(id='tg18-solo-status');solo.string='🎤 Modo solo opcional: o microfone deste aparelho capta sua voz sem retransmiti-la aos alto-falantes.'
# one main QR prompt instead of secondary rhetoric
rail=stage.find(class_='qr-rail');
for cn in ['qr-rail-copy','qr-rail-stamp']:
 el=rail.find(class_=cn)
 if el: el.decompose()
rail.find(class_='qr-footer').find('small').string='Aponte a câmera e entre na festa'
# stage toolbar below panel: leave fullscreen readily available
stage_footer=s.new_tag('footer',attrs={'class':'tg19-stage-footer','aria-label':'Outras opções da festa'})
for id in ['open-stage-faq','theme-cycle','contrast-toggle','stage-switch','stage-exit']:
 el=stage.find(id=id)
 if el: stage_footer.append(el.extract())
settings=stage.find(class_='stage-actions').find(class_='open-settings')
if settings:stage_footer.append(settings.extract())
# move remote link to footer so TV stays in the main stage
remote_open=stage.find(id='tg18-remote-open')
if remote_open:stage_footer.insert(0,remote_open.extract())
# move sidebar history/ranking/catalog after the control sidebar main queue
sidebar=stage.find(class_='stage-sidebar')
for cn in ['stage-rank-panel','stage-hit-library']:
 el=sidebar.find(class_=cn)
 if el: stage_footer.append(el.extract())
stage.find(class_='stage-layout').append(stage_footer)
# remote tab UI, controls vs singing
remote=s.find(id='tg18-remote');shell=remote.find(class_='tg18-remote-shell')
remote_intro=shell.find('p');remote_intro.string='Notebook na TV, celular no comando. Escolha uma aba para controlar ou cantar.'
tab_nav=s.new_tag('nav',attrs={'class':'tg19-remote-tabs','role':'tablist','aria-label':'Modo do anfitrião'})
for id,text,sel in [('tg19-tab-control','🎛️ Controle','true'),('tg19-tab-singing','🎤 Eu cantando','false')]:
 btn=s.new_tag('button',id=id,attrs={'type':'button','role':'tab','aria-selected':sel,'class':'tg19-remote-tab'+(' active' if sel=='true' else '')});btn.string=text;tab_nav.append(btn)
remote_intro.insert_after(tab_nav)
control=s.new_tag('div',id='tg19-remote-control',attrs={'role':'tabpanel','aria-labelledby':'tg19-tab-control'})
for element in list(shell.contents):
 if getattr(element,'name',None) is None:continue
 if element.get('id')=='tg18-remote-mic' or element is tab_nav:continue
 if element.name=='label' and element.find('input',id='tg18-remote-playback'):
  control.append(element.extract());continue
 if element.name=='label' and element.find('input',id='tg18-remote-mics'):
  control.append(element.extract());continue
 if element.get('class') and any(c in element.get('class') for c in ['tg18-remote-status','tg18-remote-grid']):
  control.append(element.extract())
feedback=shell.find(id='tg18-remote-feedback');control.append(feedback.extract())
singing=s.new_tag('div',id='tg19-remote-singing',attrs={'role':'tabpanel','aria-labelledby':'tg19-tab-singing','hidden':''})
intro2=s.new_tag('div',attrs={'class':'tg19-remote-idle','id':'tg19-remote-idle'})
img=s.new_tag('img',src='./diva-busto.png',alt='Diva Gogó, apresentadora')
intro2.append(img)
h2=s.new_tag('h2');h2.string='VOCÊ TAMBÉM É A ESTRELA!';intro2.append(h2)
para=s.new_tag('p');para.string='Escolha um hit. Quando a Diva chamar, o microfone aparece aqui para você autorizar e ficar pronto(a) em um toque.';intro2.append(para)
singing.append(intro2)
mic=shell.find(id='tg18-remote-mic');singing.append(mic.extract())
for cn in ['tg18-remote-singer-tools']:
 el=shell.find(class_=cn)
 if el: singing.append(el.extract())
# personal score
score=s.new_tag('p',id='tg19-remote-score',attrs={'class':'tg19-remote-score','aria-live':'polite'});score.string='Seu placar aparece depois de cantar.';singing.append(score)
# live mic level meter from same analyzer as guest
meter=s.new_tag('div',id='tg19-remote-levels',attrs={'class':'tg19-remote-levels','aria-label':'Nível da voz ao vivo'})
for _ in range(12):meter.append(s.new_tag('i'))
mic.find(class_='tg18-remote-mic-status').insert_after(meter)
# gain adjustable on singer tab
volume=s.new_tag('label',attrs={'class':'tg19-remote-vocal-gain'})
volume.string='🎚️ Intensidade da minha voz na TV'
range_el=s.new_tag('input',id='tg19-remote-vocal-gain',attrs={'type':'range','min':'0','max':'150','step':'5','value':'100'})
volume.append(range_el);mic.find(id='tg18-remote-mic-note').insert_before(volume)
# indicator no more premature access
ready=mic.find(id='tg18-remote-mic-ready');ready['hidden']='';ready['disabled']=''
control_btn=mic.find(id='tg18-remote-mic-toggle');control_btn.string='🎙️ ATIVAR MIC E FICAR PRONTO(A)'
# stage switching is secondary and ends up footer
switch=remote.find(id='tg18-remote-stage');shell.append(control);shell.append(singing)
# switch remains below tabs but not singing as secondary
if switch: switch.string='📺 Transferir o palco para este aparelho (somente se a TV não estiver em uso)'
# separate footer for mobile control
# guest move promotional content and recados to appropriate place
s.find(id='guest-queue-panel').append(s.find(id='tg17-guest-message').extract())
guest_bottom=s.find(class_='guest-bottom');guest_bottom.insert(0,s.find(class_='tg18-account-promo').extract())
# guest mic only during call: navigation shown dynamically
s.find(id='mobile-tab-mic')['hidden']=''
s.find(id='tg16-mic-shortcut')['hidden']=''
s.find(id='guest-mic-panel')['hidden']=''
pre_actions=s.find(id='guest-preflight').find(class_='preflight-actions')
pre_actions.find(id='guest-preflight-mic').string='🎙️ ATIVAR MIC E FICAR PRONTO(A)'
pre_actions.find(id='guest-preflight-ready')['hidden']=''
# remove 2 step from turn overlay
s.find(id='tg18-turn-mic').string='🎙️ ATIVAR MIC E FICAR PRONTO(A)'
s.find(id='tg18-turn-ready')['hidden']=''
s.find(id='tg18-turn-ready')['disabled']=''
s.find(id='tg18-turn-overlay').find('small').string='Ao permitir o microfone, o anfitrião será avisado automaticamente. O vídeo só começa quando ele liberar.'
# don't ask mic permission in extra dialog
if s.find(id='mic-permission-dialog'):s.find(id='mic-permission-dialog')['data-unused-v19']='true'
# update FAQ explicitly
faq=s.find(id='faq-dialog')
for details in faq.find_all('details'):
 summ=details.find('summary');txt=summ.get_text(' ',strip=True)
 if txt.startswith('Como canto?'):
  details.find('p').string='Escolha a música e os participantes. Quando a Diva chamar, toque em “Ativar mic e ficar pronto(a)”: o navegador pede a autorização e o anfitrião recebe a confirmação automaticamente. O vídeo começa somente com a liberação do host.'
 elif txt.startswith('Como sei se o microfone funciona?'):
  details.find('p').string='O medidor e os comandos de voz só aparecem durante sua chamada ou apresentação. Libere o microfone no celular e veja as barras de captação; a conexão com a TV acontece quando o vídeo começa.'
 elif txt.startswith('O que significa Estou pronto?'):
  details.find('p').string='A prontidão é confirmada automaticamente assim que o microfone for autorizado e iniciado após a chamada da Diva. Se o microfone falhar, o host verá que você ainda não está pronto(a).'
# version badge
for text in s.find_all(string=True):
 if 'O REALITY DO SEU ROLÊ · BETA 16' in str(text):text.replace_with(str(text).replace('BETA 16','BETA 19'))
(p/'index.html').write_text(str(s),encoding='utf-8')
print('HTML updated',len(str(s)))
