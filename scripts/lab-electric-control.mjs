export async function crossElectric(page) {
  await page.evaluate(() => new Promise((resolve,reject)=> {
    const store=window.__quantumGame;
    const initialDeaths=store.getState().lab.deaths;
    const trace=[];
    let lane=0,moving=false,unsubscribe=()=>{};
    const send=type=>window.dispatchEvent(new KeyboardEvent(type,{code:'KeyW',key:'w',bubbles:true}));
    const finish=(error)=>{clearTimeout(timer);unsubscribe();send('keyup');error?reject(Error(error+' '+JSON.stringify(trace))):resolve()};
    const timer=setTimeout(()=>finish('Electric timeout'),45000);
    const update=(s,old)=>{
      if(s.lab.deaths!==initialDeaths){finish('Unexpected electric death');return}
      if(s.pos!==old.pos) {trace.push({lane,moving,z:s.pos[2],time:s.lab.time,phase:(s.lab.time+lane*.6)%5.5});if(trace.length>35)trace.shift()}
      if(moving&&s.pos[2]>=lane*2+1.4){send('keyup');moving=false;lane++;if(lane===3){finish();return}}
      if(!moving&&(s.lab.time+lane*.6)%5.5<.6) moving=true;
      if(moving)send('keydown');else send('keyup');
    };
    unsubscribe=store.subscribe(update);
    update(store.getState(),store.getState());
  }));
}

export async function touchLiveTile(page) {
  await page.evaluate(()=>new Promise((resolve,reject)=>{
    const store=window.__quantumGame,initialDeaths=store.getState().lab.deaths;
    let started=false,unsubscribe=()=>{};
    const send=type=>window.dispatchEvent(new KeyboardEvent(type,{code:'KeyW',key:'w',bubbles:true}));
    const timer=setTimeout(()=>{unsubscribe();send('keyup');reject(Error('Expected electric hit timed out'))},15000);
    unsubscribe=store.subscribe(s=>{
      if(s.lab.deaths>initialDeaths){clearTimeout(timer);unsubscribe();send('keyup');resolve();return}
      const phase=s.lab.time%5.5;
      if(!started&&phase>=3.6&&phase<4.2)started=true;
      if(started)send('keydown');else send('keyup');
    });
  }));
}
