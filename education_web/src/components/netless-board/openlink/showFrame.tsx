import React, { useRef } from 'react';
import { observer } from 'mobx-react';
import { useBoardStore, useRoomStore } from '@/hooks';
import "./showFrame.scss"

export const ShowFrame = observer(() => {
  const boardStore = useBoardStore();
  const roomStore = useRoomStore();
  
  const handleSharing = async(e:any) => {
    if(e==="share")
      await roomStore.startOrStopSharing()
    if(e==="close"){
      boardStore.setTool('');
      boardStore.setTool('hand');
   }
  }
  const showOverlay = () =>{
    return (<div className="overlay"></div>)
  }

    return (
      <div className="show-iframe" id="stepappFrame">
        <div className="items">
          <div className="item" onClick={e=> handleSharing("share")}><span className="screen_sharing"></span> share Screen</div>
          <div className="item" onClick={e=> handleSharing("close")}><span className=""></span> Close</div>
        </div>
        {!(boardStore.hasPermission) ? 
          showOverlay() : 
          <iframe src="https://learn.stepapp.in/" allow="display-capture"></iframe>
        }
        <video id="sharingVideo" style={{display:boardStore.hasPermission?"none":"block"}}  autoPlay />
      </div>
    )
})