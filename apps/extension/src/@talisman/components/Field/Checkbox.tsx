// @ts-nocheck
import styled from "styled-components"
import Field, { IFieldProps, fieldDefaultProps } from "./Field"

interface IProps extends IFieldProps {
  onChange: (value: boolean) => void
}

const defaultProps: IProps = {
  ...fieldDefaultProps,
}

const Toggle = ({ value, onChange, fieldProps, ...rest }: IProps) => (
  <Field {...rest} onClick={() => onChange(!value)}>
    <div className="checkbox" />
  </Field>
)

const StyledToggle = styled(Toggle)`
  position: relative;
  cursor: pointer;
  overflow: visible;
  opacity: 0.5;

  .field-header {
    display: inline-block;
    width: auto;
  }

  .children {
    display: inline-block;
    width: auto;
    //opacity: 0.5;
  }

  .checkbox {
    width: 1em;
    height: 1em;
    position: relative;
    overflow: hidden;
    border-radius: 50%;

    &:after {
      content: "";
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 0.5em;
      height: 0.5em;
      background: rgba(var(--color-mid-raw), 0.4);
      border-radius: 50%;
    }
  }

  ${({ value }) =>
    value === true &&
    `
    opacity: 1;

    .checkbox:after{
      background: rgba(var(--color-primary-raw), 1);
    }
  `}
`

StyledToggle.defaultProps = defaultProps

export default StyledToggle
