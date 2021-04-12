import React, { Fragment } from 'react';
import {CustomIcon} from '@/components/icon';
import { Tooltip, ClickAwayListener } from '@material-ui/core';
import {UploadBtn} from './upload/upload-btn'
import { observer } from 'mobx-react';
import { useBoardStore, useRoomStore } from '@/hooks';
import { BoardStore } from '@/stores/app/board';
import { SketchPicker } from 'react-color';
import { PPTProgressPhase } from '@/utils/upload-manager';
import { get } from 'lodash';
import { t } from '@/i18n';
import {ShowFrame} from './openlink/showFrame'


const ToolItem = (props: any) => {
  const onClick = (evt: any) => {
    props.onClick(props.name);
  }
  return (
    <Tooltip title={props.text} placement="right">
      <span>
      <CustomIcon data={props.name}
        onClick={onClick} className={`items ${props.name} ${props.active ? 'active' : ''}`} />
      </span>
    </Tooltip>
  )
}

export const Tools = observer(() => {

  const items: any[] = BoardStore.items

  const boardStore = useBoardStore()

  const roomStore = useRoomStore()

  const handleClickOutSide = () => {
    switch(boardStore.selector) {
      case 'upload': {
        boardStore.setTool('')
        break;
      }
      case 'stepapp': {
       // boardStore.setTool('');
       // boardStore.setTool('hand');
        break;
      }
      case 'color_picker': {
        boardStore.setTool('pencil')
        break;
      }
      case 'text': {
        boardStore.setTool('')
        break;
      }
    }
  }

  return (
    <ClickAwayListener onClickAway={handleClickOutSide}>
      <div className="tools">
          <div className="board-tools-menu">
            {items
              .filter((it: any) => {
                if (get(roomStore, 'roomInfo.userRole', 'student') === 'student') {
                  if (['add', 'upload', 'hand_tool'].indexOf(it.name) !== -1) return false
                }
                return true
              })
              .map((item: any, key: number) => (
              <ToolItem
                key={key}
                text={item.text}
                name={item.name}
                onClick={(name: string) => {
                  boardStore.setTool(name)
                }}
                active={boardStore.selector === item.name}
              >
              </ToolItem>
            ))}
          </div>
        {boardStore.showColorPicker ? 
          <SketchPicker
            color={boardStore.strokeColor}
            onChangeComplete={(color: any) => {
              boardStore.changeColor(color)
            }}
          />
        : null
        }  
        {boardStore.showUpload ?
          <UploadBtn />
          : null
        }
         
      </div>
    </ClickAwayListener>

  )
})