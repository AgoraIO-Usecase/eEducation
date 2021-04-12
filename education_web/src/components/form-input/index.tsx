import React, { useRef , useState} from 'react';
import {makeStyles} from '@material-ui/core/styles';
import { Theme, Typography, InputLabel, Input } from '@material-ui/core';
import UAParser from "ua-parser-js"
import { isElectron } from '@/utils/platform';

const parser = new UAParser()

const userAgentInfo = parser.getResult()

const useStyles = makeStyles ((theme: Theme) => ({
  formInput: {
    'ime-mode': 'disabled',
    '&:after': {
      borderBottom: '1px solid #44a2fc'
    }
  },
  required: {
    fontSize: '12px',
    color: '#ff0000',
    lineHeight: '17px',
    position: 'absolute',
    top: '48px'
  }
}));

const ALPHABETICAL = /^[a-zA-Z0-9]*/
const LIMIT_LENGTH = 20
export const FormInput = (props: any) => {
  const classes = useStyles();

  const imeLock = useRef<boolean>(false)
  
  const onCompositionStart = (evt: any) => {
    imeLock.current = true
  }

  const updateValue = (value: string) => {
    props.onChange(value)
  }

  const onCompositionEnd = (evt: any) => {
    imeLock.current = false
    //updateValue(props.value.replace(/[^0-9a-zA-Z$]/g, '').slice(0, LIMIT_LENGTH))
    updateValue(props.value.slice(0, LIMIT_LENGTH))
  }

  const onChange = (evt: any) => {
    //const val = evt.target.value.replace(/[^0-9a-zA-Z$]/g, '').slice(0, LIMIT_LENGTH)
    const val = evt.target.value.slice(0, LIMIT_LENGTH)
    if (imeLock.current) {
    } else {
      evt.target.value = val
      updateValue(evt.target.value)
    }
    imeLock.current = false
  }
  return (
    <>
      <InputLabel>{props.Label}</InputLabel>
      <Input className={classes.formInput} value={props.value}
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
        inputProps={{
          maxLength: 20
        }}
        onChange={onChange}>
      </Input>
      {props.requiredText ? <Typography className={classes.required}>{props.requiredText}</Typography> : null}
    </>
  );
}