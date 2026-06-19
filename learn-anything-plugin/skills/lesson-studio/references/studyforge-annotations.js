/* StudyForge Annotation Layer (Unified) */
(function(){
  "use strict";

  const TOOLBAR_ID="sfAnnotationToolbar";

  function getSelectionText(){
    const sel=window.getSelection();
    return sel?sel.toString():"";
  }

  function ensureToolbar(){
    let el=document.getElementById(TOOLBAR_ID);
    if(!el){
      el=document.createElement("div");
      el.id=TOOLBAR_ID;
      el.innerHTML='<button id="sfAnnotateBtn">Annotate</button>';
      document.body.appendChild(el);
    }
    return el;
  }

  function bind(){
    document.addEventListener("mouseup",()=>{
      const text=getSelectionText();
      if(!text)return;
      ensureToolbar().hidden=false;
    });

    document.addEventListener("keydown",(e)=>{
      if(e.key==="Escape"){
        const el=document.getElementById(TOOLBAR_ID);
        if(el)el.hidden=true;
      }
    });
  }

  document.addEventListener("DOMContentLoaded",bind);
})();
