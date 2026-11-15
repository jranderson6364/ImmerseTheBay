"""Render sourced, schematic 2D hologram loops for the centerpiece opening cards.

These are intentionally diagrams of documented objects, not invented portraits or literal reconstructions.
Black is transparent on the additive Spectacles display. Each output is silent H.264 baseline, 640x360, 4 s.
"""

import math
import subprocess
from pathlib import Path
import imageio_ffmpeg
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1] / "Assets/Retrospecs/Art"
W,H,FPS,SECONDS = 640,360,15,4
S=2
INK=(236,215,255)
LAV=(173,138,220)
COPPER=(244,171,116)
BLUE=(116,194,242)


def line(d,pts,color=INK,width=3): d.line([(round(x*S),round(y*S)) for x,y in pts],fill=color,width=width*S,joint="curve")
def rect(d,box,outline=INK,width=3,fill=None): d.rectangle(tuple(round(v*S) for v in box),fill=fill,outline=outline,width=width*S)
def ellipse(d,box,outline=INK,width=3,fill=None): d.ellipse(tuple(round(v*S) for v in box),fill=fill,outline=outline,width=width*S)


def hoover(d,t):
    # Hoover Tower / archive: papers move into storage. Tower and archive are established in the sources.
    line(d,[(182,311),(455,311)],LAV,3)
    rect(d,(268,82,371,312),LAV,4)
    for y in (107,137,167,197,227,257,287): line(d,[(276,y),(363,y)],INK,2)
    line(d,[(259,82),(320,45),(380,82)],COPPER,4)
    rect(d,(94,231,231,312),INK,3)
    rect(d,(108,212,217,238),COPPER,3)
    for j in range(3):
        phase=(t/SECONDS+j/3)%1
        x=84+116*phase; y=188+28*math.sin(phase*math.pi)
        alpha=1-abs(phase-.5)*.6
        c=tuple(int(v*alpha) for v in INK)
        rect(d,(x,y,x+34,y+26),c,2)
        line(d,[(x+6,y+9),(x+27,y+9)],c,1)
    for j in range(4):
        y=254+j*13
        line(d,[(113,y),(208,y)],LAV,2)
    # Gentle halo is a motion cue, not a factual feature.
    r=8+4*math.sin(t*2*math.pi/SECONDS)
    ellipse(d,(320-r,61-r,320+r,61+r),COPPER,2)


def huang(d,t):
    # Ten drives inside a toy-block rack: the documented 1996 PageRank storage server.
    rect(d,(168,66,473,311),COPPER,5)
    for j in range(13):
        x=174+j*23
        rect(d,(x,53,x+18,69),(235,106,99) if j%3==0 else BLUE if j%3==1 else COPPER,1,
             (235,106,99) if j%3==0 else BLUE if j%3==1 else COPPER)
    for row in range(5):
        for col in range(2):
            x=188+col*140; y=91+row*40
            rect(d,(x,y,x+123,y+30),INK,2)
            line(d,[(x+13,y+16),(x+88,y+16)],LAV,2)
            lit=(row*2+col)==int((t/SECONDS)*10)%10
            ellipse(d,(x+101,y+11,x+111,y+21),BLUE if lit else LAV,2,BLUE if lit else None)
    for x in (184,218,252,286,320,354,388,422,456):
        ellipse(d,(x-3,297,x+3,303),COPPER,1,COPPER)


def memchu(d,t):
    # Memorial Church facade mosaic forms tile by tile; Jane's notched umbrella sits beside it.
    line(d,[(99,307),(539,307)],LAV,3)
    line(d,[(178,130),(320,56),(462,130)],COPPER,4)
    rect(d,(190,131,450,307),INK,3)
    for row in range(7):
        for col in range(11):
            x=210+col*20; y=151+row*18
            order=(row*11+col)/77
            pulse=(t/SECONDS+.13)%1
            active=order<=pulse
            color=(211,169,245) if active else (78,62,95)
            rect(d,(x,y,x+14,y+12),color,1,color)
    # A parasol is sourced as Jane Stanford's tool for checking carved relief.
    d.arc((round(494*S),round(111*S),round(618*S),round(198*S)),180,360,fill=COPPER,width=4*S)
    line(d,[(556,154),(556,277)],INK,3)
    d.arc((round(555*S),round(252*S),round(585*S),round(293*S)),0,180,fill=INK,width=3*S)


def render(name,draw_scene):
    dest=ROOT/name/f"{name}_story_hologram.mp4"
    cmd=[imageio_ffmpeg.get_ffmpeg_exe(),"-hide_banner","-loglevel","error","-y",
         "-f","rawvideo","-pixel_format","rgb24","-video_size",f"{W}x{H}","-framerate",str(FPS),"-i","-",
         "-an","-c:v","libx264","-profile:v","baseline","-level","3.0","-pix_fmt","yuv420p",
         "-crf","24","-movflags","+faststart",str(dest)]
    with subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=subprocess.PIPE) as proc:
        for n in range(FPS*SECONDS):
            im=Image.new("RGB",(W*S,H*S),(0,0,0))
            d=ImageDraw.Draw(im)
            draw_scene(d,n/FPS)
            im=im.resize((W,H),Image.Resampling.LANCZOS)
            proc.stdin.write(im.tobytes())
        proc.stdin.close()
        err=proc.stderr.read().decode(errors="replace")
        if proc.wait()!=0: raise RuntimeError(err)
    print(dest)


def varian(d,t):
    # The klystron in cutaway (varian.2): an even beam leaves the cathode, the buncher sorts it into bunches over the
    # drift, each bunch rings the catcher and a pulse climbs the output waveguide. Bunching is idealised, not simulated.
    cy=200
    rect(d,(70,150,128,250),INK,4)
    line(d,[(120,170),(120,230)],COPPER,4)
    line(d,[(128,176),(520,176)],LAV,3); line(d,[(128,224),(520,224)],LAV,3)
    for x in (210,430):
        rect(d,(x-26,104,x+26,176),COPPER,3); rect(d,(x-26,224,x+26,296),COPPER,3)
    rect(d,(418,40,442,104),INK,3)
    d.polygon([(round(520*S),round(166*S)),(round(580*S),round(166*S)),(round(596*S),round(186*S)),(round(596*S),round(214*S)),
               (round(580*S),round(234*S)),(round(520*S),round(234*S))],outline=tuple(INK),width=4*S)
    phase=(t/SECONDS)%1
    spacing=26
    for k in range(-1,18):
        x0=130+(k+phase*4)*spacing
        if x0<130 or x0>520: continue
        # Past the buncher, beads close on the nearest bunch centre (every fourth bead).
        k_centre=round((x0-130)/(spacing*4))*spacing*4+130
        pull=max(0.0,min(1.0,(x0-210)/180))
        x=x0+(k_centre-x0)*pull*0.85
        ellipse(d,(x-5,cy-5,x+5,cy+5),BLUE,1,BLUE)
    # Catcher glow when a bunch passes, and a pulse rising up the waveguide.
    ring=abs(math.sin(phase*4*math.pi))
    c=tuple(int(v*(0.35+0.65*ring)) for v in BLUE)
    ellipse(d,(430-40-ring*10,140-ring*6,430+40+ring*10,260+ring*6),c,2)
    py=104-((phase*4)%1)*70
    ellipse(d,(430-9,py-9,430+9,py+9),COPPER,2,COPPER)
    r=((phase*4)%1)*60
    if r>4: ellipse(d,(430-r,40-r*0.4,430+r,40+r*0.4),tuple(int(v*(1-r/60)) for v in COPPER),2)


def spilker(d,t):
    # GPS (spilker.1/.2): satellites on inclined orbits around a globe, with signals pulsing down to a receiver pin.
    cx,cy,R=320,190,70
    ellipse(d,(cx-R,cy-R,cx+R,cy+R),INK,3)
    ellipse(d,(cx-R,cy-R*0.32,cx+R,cy+R*0.32),LAV,2)
    ellipse(d,(cx-R*0.45,cy-R,cx+R*0.45,cy+R),LAV,2)
    pin=(cx+28,cy-48)
    ellipse(d,(pin[0]-6,pin[1]-6,pin[0]+6,pin[1]+6),COPPER,2,COPPER)
    line(d,[pin,(pin[0],pin[1]+14)],COPPER,3)
    phase=t/SECONDS
    sats=[]
    for o,tilt in enumerate((-0.5,0.15,0.75)):
        pts=[]
        for i in range(65):
            a=i*2*math.pi/64
            x,y=200*math.cos(a),62*math.sin(a)
            pts.append((cx+x*math.cos(tilt)-y*math.sin(tilt),cy+x*math.sin(tilt)+y*math.cos(tilt)))
        line(d,pts,tuple(int(v*0.55) for v in LAV),2)
        for s in range(2):
            a=2*math.pi*(phase+s/2+o/3)
            x,y=200*math.cos(a),62*math.sin(a)
            p=(cx+x*math.cos(tilt)-y*math.sin(tilt),cy+x*math.sin(tilt)+y*math.cos(tilt))
            sats.append(p)
            rect(d,(p[0]-7,p[1]-5,p[0]+7,p[1]+5),INK,2,INK)
            line(d,[(p[0]-20,p[1]),(p[0]-8,p[1])],BLUE,3); line(d,[(p[0]+8,p[1]),(p[0]+20,p[1])],BLUE,3)
    # Signal lines from the four highest satellites, each with a pulse travelling toward the pin.
    for j,p in enumerate(sorted(sats,key=lambda q:q[1])[:4]):
        line(d,[p,pin],tuple(int(v*0.4) for v in BLUE),1)
        f=(phase*3+j*0.25)%1
        x=p[0]+(pin[0]-p[0])*f; y=p[1]+(pin[1]-p[1])*f
        ellipse(d,(x-4,y-4,x+4,y+4),BLUE,1,BLUE)


def moore(d,t):
    # Materials research (moore.2): a slowly turning crystal lattice with one atom hopping into a vacancy.
    cx,cy,s=320,180,74
    a=2*math.pi*t/SECONDS/2
    pts={}
    for i in range(3):
        for j in range(3):
            for k in range(3):
                x,y,z=(i-1)*s,(j-1)*s,(k-1)*s
                xr=x*math.cos(a)-z*math.sin(a); zr=x*math.sin(a)+z*math.cos(a)
                yr=y*math.cos(0.45)-zr*math.sin(0.45); zz=y*math.sin(0.45)+zr*math.cos(0.45)
                pts[(i,j,k)]=(cx+xr,cy+yr,zz)
    for (i,j,k),p in pts.items():
        for di,dj,dk in ((1,0,0),(0,1,0),(0,0,1)):
            q=pts.get((i+di,j+dj,k+dk))
            if q: line(d,[p[:2],q[:2]],tuple(int(v*0.5) for v in LAV),2)
    vac,hop=(2,0,2),(1,0,2)
    f=0.5-0.5*math.cos(2*math.pi*t/SECONDS)
    for key,p in sorted(pts.items(),key=lambda kv:kv[1][2]):
        if key==vac:
            ellipse(d,(p[0]-15,p[1]-15,p[0]+15,p[1]+15),LAV,2); continue
        x,y=p[0],p[1]
        if key==hop:
            q=pts[vac]; x=p[0]+(q[0]-p[0])*f; y=p[1]+(q[1]-p[1])*f
            ellipse(d,(x-17,y-17,x+17,y+17),BLUE,2,BLUE); continue
        depth=0.6+0.4*(p[2]+s*1.8)/(s*3.6)
        col=tuple(int(v*depth) for v in (COPPER if key[1]==0 else INK))
        ellipse(d,(x-14,y-14,x+14,y+14),col,2,col)


SCENES={"hoover":hoover,"huang":huang,"memchu":memchu,"varian":varian,"spilker":spilker,"moore":moore}
if __name__=="__main__":
    import sys
    for name in (sys.argv[1:] or ["hoover","huang","memchu"]):
        render(name,SCENES[name])
