import React, { useEffect, useRef, useCallback } from 'react';
import { BoardLoading } from './loading';
import { Tools } from './tools';
import { FooterMenu } from './footer-menu';
import { FolderMenu } from './folder-menu';
// import 'white-web-sdk/style/index.css';
import { observer } from 'mobx-react';
import { useBoardStore } from '@/hooks';
import { UploadNotice } from './upload/upload-notice';
import './netless-whiteboard.scss';
import {ShowFrame} from './openlink/showFrame'


export const Board = observer(() => {
  const boardStore = useBoardStore()
  const boardRef = useRef<HTMLDivElement | null>(null)

  const mountToDOM = useCallback((dom: any) => {
    if (dom) {
      boardStore.mount(dom)
    } else {
      boardStore.unmount()
    }
  }, [boardRef.current, boardStore])

  return (
    <div className="board-container">
      <FolderMenu />
      <div ref={mountToDOM} className="edu-demo-board" id="netless-board"></div>
      {boardStore.hasPermission ? <Tools /> : null}
      <FooterMenu/>
      <BoardLoading />
      <UploadNotice />
      <ShowFrame />
      {/* {boardStore.showStepappFrame ?
          <ShowFrame />
          : null
        }  */}
    </div>
  )
})