import React from 'react';
import { Board } from './board';
import { observer } from 'mobx-react';
import { useBoardStore } from '@/hooks';

export const NetlessBoard = observer((props: any) => {

  const {ready} = useBoardStore()
  return (
    ready ? <Board /> : <div className="board-container"></div>
  )
})