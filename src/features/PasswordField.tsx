import { forwardRef, useState, type ComponentProps } from 'react';
import { TextField } from '@/components/Form';
import { IconButton } from '@/components/IconButton';
import { Eye, EyeOff } from '@/components/icons';

type Props = Omit<ComponentProps<typeof TextField>, 'type' | 'trailing'>;

/** Password input with a visibility control; paste and password managers stay allowed. */
export const PasswordField = forwardRef<HTMLInputElement, Props>(
  function PasswordField(props, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <TextField
        ref={ref}
        {...props}
        type={visible ? 'text' : 'password'}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        trailing={
          <IconButton
            icon={visible ? EyeOff : Eye}
            label={visible ? 'Hide password' : 'Show password'}
            active={visible}
            size={20}
            onClick={() => setVisible((current) => !current)}
          />
        }
      />
    );
  },
);
