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
  <Field {...rest}>
    <div className="toggle" data-on={value === true} onClick={() => onChange(!value)}>
      <span />
    </div>
  </Field>
)

const StyledToggle = styled(Toggle)`
  position: relative;
  cursor: pointer;
  overflow: visible;

  .field-header {
    display: inline-block;
    width: auto;
  }

  .children {
    overflow: visible;
    margin: 0.2em;
    background: none;
    display: inline-block;
    width: auto;
  }

  .toggle {
    width: 2.8em;
    height: 1.6em;
    position: relative;
    overflow: visible;
    margin: 0 0.2em;
    border-radius: 0.8em;
    background: rgba(var(--color-foreground-raw), 0.15);

    > span {
      content: "";
      position: absolute;
      top: 50%;
      left: 0.2em;
      transform: translateY(-50%);
      width: 1.2em;
      height: 1.2em;
      background: var(--color-background);
      display: inline-block;
      border-radius: 50%;
      transition: all 0.2s ease;
      opacity: 0.5;
    }

    &[data-on="true"] {
      > span {
        background: var(--color-primary);
        left: calc(100% - 1.4em);
        opacity: 1;
      }
    }
  }
`

StyledToggle.defaultProps = defaultProps

export default StyledToggle
