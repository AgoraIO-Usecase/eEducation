import React, { useState } from 'react';
import { CustomIcon } from '@/components/icon';
import './nav.scss';
import { CustomButton } from '@/components/custom-button';
import * as moment from 'moment';
import { isElectron, platform } from '@/utils/platform';
// import Log from '@/utils/LogUploader';
import { Tooltip } from '@material-ui/core';
import { useUIStore, useRoomStore, useAppStore, useMediaStore, useBreakoutRoomStore } from '@/hooks';
import { t } from '@/i18n';
import { observer } from 'mobx-react';
import { useLocation } from 'react-router-dom';
import { networkQualities as networkQualityIcon } from '@/stores/app/room'
import { EduManager } from '@/sdk/education/manager';

interface NavProps {
  delay: string
  network: string
  cpu: string
  role: string
  roomName: string
  time: number
  classState: boolean
}

const BreakoutStartClassButton = observer((props: any) => {

  const breakoutRoomStore = useBreakoutRoomStore()

  const classState = breakoutRoomStore.classState === 1

  return (
    <CustomButton className={`nav-button ${classState ? "stop" : "start"}`} name={classState ? t('nav.class_end') : t('nav.class_start')} onClick={async (evt: any) => {
      if (!classState) {
        await breakoutRoomStore.startClass()
      } else {
        await breakoutRoomStore.stopClass()
      }
    }} />
  )
})

const BasicStartClassButton = observer((props: any) => {
  const roomStore = useRoomStore()

  const classState = roomStore.classState === 1

  return (
    <CustomButton className={`nav-button ${classState ? "stop" : "start"}`} name={classState ? t('nav.class_end') : t('nav.class_start')} onClick={async (evt: any) => {
      if (!classState) {
        await roomStore.startClass()
      } else {
        await roomStore.stopClass()
      }
    }} />
  )
})

const StartClassButton = (props: any) => {
  return (
    props.isBreakout ? <BreakoutStartClassButton /> : <BasicStartClassButton />
  )
}

const BreakoutUploadButton = observer(() => {
  
  const uiStore = useUIStore()
  const breakoutRoomStore = useBreakoutRoomStore()

  const [lock, setLock] = useState<boolean>(false)

  const handleUpload = async () => {
    try {
      setLock(true)
      const id = await EduManager.uploadLog(breakoutRoomStore.roomUuid)
      uiStore.showDialog({
        type: 'feedLog',
        message: `id: ${id}`
      })
      setLock(false)
    } catch (err) {
      uiStore.addToast(t('upload_log_failed'))
      setLock(false)
    }
  }

  return (
    <Tooltip title={t("icon.upload-log")} placement="bottom">
      <span>
        <CustomIcon className={lock ? "icon-loading" : "icon-upload"}
          onClick={async (evt: any) => {
            await handleUpload()
          }}>
        </CustomIcon>
      </span>
    </Tooltip>
  )
})

const BasicUploadButton = observer(() => {

  const roomStore = useRoomStore()
  const uiStore = useUIStore()

  const [lock, setLock] = useState<boolean>(false)

  const handleUpload = async () => {
    try {
      setLock(true)
      const id = await EduManager.uploadLog(roomStore.roomUuid)
      uiStore.showDialog({
        type: 'feedLog',
        message: `id: ${id}`
      })
      setLock(false)
    } catch (err) {
      uiStore.addToast(t('upload_log_failed'))
      setLock(false)
    }
  }

  return (
    <Tooltip title={t("icon.upload-log")} placement="bottom">
      <span>
        <CustomIcon className={lock ? "icon-loading" : "icon-upload"}
          onClick={async (evt: any) => {
          await handleUpload()
          }}>
        </CustomIcon>
      </span>
    </Tooltip>
  )
})

const UploadButton = (props: any) => {
  return (
    props.isBreakout ? <BreakoutUploadButton /> : <BasicUploadButton />
  )
}

export const Nav = observer((props: any) => {
  const uiStore = useUIStore();

  const appStore = useAppStore();

  const mediaStore = useMediaStore();

  const location = useLocation()

  const role = appStore.roomInfo.userRole
  const roomName = appStore.roomInfo.roomName

  const delay = mediaStore.delay
  const time = appStore.time
  const network = mediaStore.networkQuality
  const cpu = appStore.cpuRate

  const isCourses = location.pathname.match(/courses/)

  const isBreakout = location.pathname.match(/breakout/)

  return (
    <>
      <div className={`nav-container ${isElectron ? 'draggable' : ''}`}>
        <div className="class-title">
          <span className="room-name">{roomName}</span>
          {role === 'teacher' ?
            <StartClassButton isBreakout={isBreakout} /> : null}
        </div>
        <div className="network-state">
          <div>
            {
              !isCourses ?
                <div className="nav-information">
                  <span>
                    {uiStore.isWeb ? <span className="net-field">{t('nav.delay')}<span className="net-field-value">{delay}</span></span> : null}
                  </span>
                  {/* <span className="net-field">Packet Loss Rate: <span className="net-field-value">{lossPacket}</span></span> */}
                  <span className="net-field net-field-container">
                    {t('nav.network')}
                    <span className={`net-field-value ${networkQualityIcon[network]}`} style={{ marginLeft: '.2rem' }}>
                    </span>
                  </span>
                  <span className="net-field net-field-container">
                    curSeqId
                    <span className={`net-field-value`} style={{ marginLeft: '.2rem' }}>
                      {uiStore.curSeqId}
                    </span>
                  </span>
                  <span className="net-field net-field-container">
                    lastSeqId
                    <span className={`net-field-value`} style={{ marginLeft: '.2rem' }}>
                      {uiStore.lastSeqId}
                    </span>
                  </span>
                  {uiStore.isElectron ? <span className="net-field">{t('nav.cpu')}<span className="net-field-value">{cpu}%</span></span> : null}
                </div> : null}
          </div>
        </div>
        <div className="menu">
          <>
          <div className="timer">
            <CustomIcon className="icon-time" disable />
            <span className="time">{moment.utc(time).format('HH:mm:ss')}</span>
          </div>
          <span className="menu-split" />
          </>
          <div className={platform === 'web' ? "btn-group" : 'electron-btn-group'}>
            {platform === 'web' ?
            <>
            <Tooltip title={t("icon.setting")} placement="bottom">
              <span>
                <CustomIcon className="icon-setting" onClick={(evt: any) => {
                 // uiStore.showSetting()
                }}/>
              </span>
            </Tooltip>
            </> : null
          }
            <UploadButton isBreakout={isBreakout} />
            <Tooltip title={t("icon.exit-room")} placement="bottom">
              <span>
                <CustomIcon className="icon-exit" onClick={(evt: any) => {
                  uiStore.showDialog({
                    type: 'exitRoom',
                    message: t('icon.exit-room')
                  })
                }} />
              </span>
            </Tooltip>
          </div>
          {uiStore.isElectron &&
            <div className="menu-group">
              <CustomIcon className="icon-minimum" icon onClick={() => {
                uiStore.windowMinimum()
              }} />
              <CustomIcon className="icon-maximum" icon onClick={() => {
                uiStore.windowMaximum()
              }} />
              <CustomIcon className="icon-close" icon onClick={() => {
                uiStore.windowClose()
              }} />
            </div>}
        </div>
      </div>
    </>
  )
})

export const NavController = () => {
  return (
    <Nav
    />
  )
}