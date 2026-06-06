import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditableItemControls } from '../EditableItemList';

it('calls onRemove with the item name', async () => {
  const onRemove = jest.fn();
  render(<EditableItemControls name="Adderall" onRemove={onRemove} onRename={jest.fn()} testIdBase="supp" idx={0} />);
  await userEvent.click(screen.getByTestId('supp-remove-0'));
  expect(onRemove).toHaveBeenCalledWith('Adderall');
});

it('enters edit mode and calls onRename with the new value', async () => {
  const onRename = jest.fn();
  render(<EditableItemControls name="Adderall" onRemove={jest.fn()} onRename={onRename} testIdBase="supp" idx={0} />);
  await userEvent.click(screen.getByTestId('supp-edit-0'));
  const input = screen.getByTestId('supp-edit-input-0');
  await userEvent.clear(input);
  await userEvent.type(input, 'Adderall XR');
  await userEvent.click(screen.getByTestId('supp-edit-save-0'));
  expect(onRename).toHaveBeenCalledWith('Adderall', 'Adderall XR');
});

it('does not call onRename when the name is unchanged', async () => {
  const onRename = jest.fn();
  render(<EditableItemControls name="Adderall" onRemove={jest.fn()} onRename={onRename} testIdBase="supp" idx={0} />);
  await userEvent.click(screen.getByTestId('supp-edit-0'));
  await userEvent.click(screen.getByTestId('supp-edit-save-0'));
  expect(onRename).not.toHaveBeenCalled();
});
