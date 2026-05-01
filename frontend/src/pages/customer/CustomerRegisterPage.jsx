import React from 'react';
import CustomerLoginPage from './CustomerLoginPage';

const CustomerRegisterPage = (props) => {
  return <CustomerLoginPage {...props} defaultMode="register" />;
};

export default CustomerRegisterPage;