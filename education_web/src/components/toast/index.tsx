import React, { useEffect, useRef, useState } from 'react';
import './toast.scss';
import { observer } from 'mobx-react';
import { useUIStore } from '@/hooks';

export interface SnackbarMessage {
  message: string;
  key: number;
}

export const useMounted = () => {
  const mounted = useRef<boolean>(true)

  useEffect(() => {
    return () => {
      mounted.current = false
    }
  }, [])
  return mounted.current
}

export const useTimeout = (fn: CallableFunction, delay: number) => {
  const mounted = useMounted()

  const timer = useRef<any>(null)

  useEffect(() => {
    timer.current = setTimeout(() => {
      fn && mounted && fn()
    }, delay)

    return () => {
      if (timer.current) {
        clearTimeout(timer.current)
      }
    }
  }, [timer])
}

interface ToastProps {
  message: string
  closeToast: CallableFunction
}

const ToastMessage = (props: ToastProps) => {

  useTimeout(() => {
    props && props.closeToast()
  }, 2500)

  return (
    <div className={"custom-toast"}>
      <div className="toast-container">
        <span className="text">{props.message}</span>
      </div>
    </div>
  )
}

export const Toast = observer(() => {

  const uiStore = useUIStore()
  console.log("here toast");
  return (<div></div>)
  /* return (
    <div className="notice-message-container">
      {uiStore.toastQueue.map((message: string, idx: number) => 
        <ToastMessage
          message={message}
          key={`${idx}${message}${Date.now()}`}
          closeToast={() => {
            uiStore.removeToast(message)
            console.log("close Toast", message)
          }}
        />
      )}
    </div>
  ) */
})