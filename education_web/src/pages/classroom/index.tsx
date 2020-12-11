import React, { useEffect, useRef } from 'react';
import { useLocation, useHistory, useParams } from 'react-router-dom';
import {NavController} from '@/components/nav';
import NativeSharedWindow from '@/components/native-shared-window';
import { DeviceDetectController } from '../device-detect';
import { AutoplayToast } from '@/components/autoplay-toast';
import { useRoomStore, useUIStore, useAppStore } from '@/hooks';
import { Loading } from '@/components/loading';
import { observer } from 'mobx-react';
import { t } from '@/i18n';

import './room.scss';

export const roomTypes = [
  {value: 0, path: 'one-to-one'},
  {value: 1, path: 'small-class'},
  {value: 2, path: 'big-class'},
  // {value: 3, path: 'breakout-class'},
];

function getIpc() {
  //@ts-ignore
  return window.ipc
}

const RoomController = observer(({children}: any) => {
  useEffect(() => {
    const ipc = getIpc()
    if (ipc && ipc.send) {
      ipc.send('resize-window', {width: 990, height: 706});
    }
    return () => {
      const ipc = getIpc()
      if (ipc && ipc.send) {
        ipc.send('resize-window', {width: 700, height: 500});
      }
    }
  }, [getIpc])

  const uiStore = useUIStore()

  const location = useLocation()

  const roomStore = useRoomStore()

  const appStore = useAppStore()

  const history = useHistory()

  const urlParams = new URLSearchParams(location.search)

  useEffect(() => {
    if (!appStore.userRole) {
      history.push('/')
      return
    }

    window.history.pushState(null, document.title, window.location.href);

    const handlePopState = (evt: any) => {
      window.history.pushState(null, document.title, null);
      if (roomStore.joined && !uiStore.hasDialog('exitRoom')) {
        uiStore.showDialog({
          type: 'exitRoom',
          message: t('icon.exit-room'),
        })
      }
    }

    window.addEventListener('popstate', handlePopState, false)

    let pathList = location.pathname.split('/')
    let path = pathList[pathList.length - 1]

    roomStore.join(urlParams).then(() => {
      uiStore.addToast(t('toast.successfully_joined_the_room'))
    }).catch((err) => {
      console.warn(err.msg)
      uiStore.addToast(t('toast.failed_to_join_the_room') + `${JSON.stringify(err.msg)}`)
    })

    
    return () => {
      window.removeEventListener('popstate', handlePopState, false)
    }
  }, [])
  
  let pathList = location.pathname.split('/')
  let path = pathList[pathList.length - 1]
  const index = roomTypes.findIndex((it: any) => path === it.path)

  const value = roomTypes[index].path
  
  return (
    <div className={`classroom ${value}`}>
      {uiStore.loading ? <Loading /> : null}
      <AutoplayToast />
      <DeviceDetectController />
      <NativeSharedWindow />
      <NavController />
      {children}
    </div>
  );
})

export function RoomPage({ children }: any) {
  return (
    <RoomController>
      {children}
    </RoomController>
  )
}

