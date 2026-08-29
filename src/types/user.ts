/**
 * A local VaatUp account.
 *
 * Accounts exist so the data model already has an owner when a backend
 * arrives; today they never leave the device. The password digest is
 * deliberately absent from this type so it cannot reach a screen.
 */
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}
