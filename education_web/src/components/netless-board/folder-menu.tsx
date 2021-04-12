import React, { useState } from 'react';
import { Tooltip, Input } from '@material-ui/core';
import {CustomIcon} from '@/components/icon'; 
import {observer} from 'mobx-react'
import { useBoardStore } from '@/hooks';

const FolderMenuItem = (props: any) => {

  const [name, setName] = useState<string>(props.name);

  const onChange = (evt: any) => {

  }

  const onRemove = () => {
    props.onRemove()
  }

  const handleClick = () => {
    if (props.handleClick) {
      props.handleClick(props.item.rootPath)
    }
  }

  return (
    <div className={`item ${props.activeClass ? 'active' : ''}`}>
      <Tooltip title={'remove'}>
        <span>
          <CustomIcon className="icon-delete" onClick={onRemove} />
        </span>
      </Tooltip>
      <div className={`cover-item ${props.coverType}`} onClick={handleClick}></div>
      <span>
        <Input className="title"
          onChange={onChange}
          defaultValue={props.name}
        />
      </span>
    </div>
  )
}

export const FolderMenu = observer(() => {

  const boardStore = useBoardStore()
  const onClose = () => boardStore.closeFolder()

  const handleClick = (scenePath: string) => boardStore.changeScenePath(scenePath)

  return (
    boardStore.showFolder ? 
    <div className="custom-netless-folder-menu">
      <div className="menu-header">
      <div className="menu-title">{boardStore.menuTitle}</div>
        <div className="menu-close" onClick={onClose}></div>
      </div>
      <div className="menu-body">
        <div className="menu-items">
          {boardStore.sceneItems.map((item: any, key: number) => (
            <FolderMenuItem
              activeClass={boardStore.activeScenePath === item.rootPath ? 'active' : ''}
              coverType={item.file.type.match(/ppt/) ? 'ppt-cover' : 'doc-cover'}
              item={item}
              name={item.file.name}
              key={key+item.path+item.file.name}
              handleClick={handleClick}
              onRemove={() => boardStore.removeScenes(item.path, item.rootPath === '/init')}
            ></FolderMenuItem>
          ))}
        </div>
      </div>
    </div> 
     : null
    )
})