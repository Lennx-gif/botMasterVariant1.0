# Implementation Plan

- [x] 1. Set up project structure and core dependencies

  - Create Node.js project with package.json and install required dependencies (telegraf, mongoose, axios, node-cron)
  - Set up TypeScript configuration and build scripts
  - Create directory structure for models, services, controllers, and utilities

  - _Requirements: 5.1, 5.2, 5.3_

- [x] 2. Implement core utilities and configuration

  - [x] 2.1 Create configuration utility with environment validation

    - Implement config loader that validates all required environment variables
    - Add type-safe configuration interface with proper error handling
    - Write unit tests for configuration validation scenarios
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 2.2 Set up logging utility with structured logging

    - Implement logger utility with different log levels and structured output
    - Add transaction and error logging capabilities
    - Write unit tests for logging functionality
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 2.3 Set up MongoDB connection with environment configuration

    - Create database connection utility with connection pooling
    - Implement connection error handling and retry logic
    - Write connection tests to verify MongoDB connectivity
    - _Requirements: 5.1, 5.3_

-

- [x] 3. Implement database models with validation

  - [x] 3.1 Create User data model with validation

    - Implement User schema with Mongoose including telegramId, username, phoneNumber fields
    - Add validation rules for required fields and data types
    - Write unit tests for User model validation and CRUD operations
    - _Requirements: 6.2_

  - [x] 3.2 Create Subscription data model with lifecycle management
    - Implement Subscription schema with userId, packageType, dates, status, and transaction fields
    - Add methods for checking expiration status and calculating end dates
    - Write unit tests for subscription lifecycle operations
    - _Requirements: 2.2, 3.2, 4.2_

  - [x] 3.3 Create Transaction data model for payment tracking

    - Implement Transaction schema with payment details and status tracking
    - Add validation for transaction data and status transitions
    - Write unit tests for transaction model operations
    - _Requirements: 6.1_

- [x] 4. Implement Mpesa payment service

  - [x] 4.1 Create Mpesa API client with authentication

    - Implement OAuth token generation using consumer key and secret
    - Create base HTTP client with proper headers and error handling
    - Write unit tests for authentication flow with mocked API responses
    - _Requirements: 5.1, 7.1_

  - [x] 4.2 Implement STK Push payment initiation

    - Create function to initiate Mpesa STK Push with phone number and amount
    - Implement payment request validation and error handling
    - Write unit tests for payment initiation with various scenarios
    - _Requirements: 1.2, 7.2_

  - [x] 4.3 Create payment callback handler
    - Implement webhook endpoint to receive Mpesa payment callbacks
    - Add transaction verification and status update logic
    - Write integration tests for callback processing
    - _Requirements: 1.3, 6.1_

  - [x] 4.4 Implement transaction verification service
    - Create function to query Mpesa transaction status
    - Add retry logic for failed verification attempts
    - Write unit tests for transaction verification scenarios
    - _Requirements: 1.3, 1.4_

- [x] 5. Create user management service

  - [x] 5.1 Implement user registration and data management
    - Create UserService class with CRUD operations for user data
    - Implement user creation from Telegram user information
    - Write unit tests for user service operations
    - _Requirements: 6.2_

  - [x] 5.2 Create subscription status checking functionality
    - Implement methods to check current user subscription status
    - Add logic to determine subscription validity and expiration
    - Write unit tests for subscription status checking
    - _Requirements: 2.2, 3.1_

- [x] 6. Implement subscription management service

  - [x] 6.1 Create subscription creation and renewal logic
    - Implement SubscriptionService with methods to create new subscriptions
    - Add renewal logic that extends existing subscriptions or creates new ones
    - Write unit tests for subscription creation and renewal scenarios
    - _Requirements: 1.3, 4.2, 4.4_

  - [x] 6.2 Implement subscription expiration checking
    - Create methods to identify expiring and expired subscriptions
    - Add logic to calculate expiration dates based on package types
    - Write unit tests for expiration detection logic
    - _Requirements: 3.1, 3.2_

  - [x] 5.3 Create subscription package pricing configuration
    - Implement pricing configuration loaded from environment variables
    - Add validation for pricing data and package types
    - Write unit tests for pricing configuration and validation
    - _Requirements: 5.3_

- [x] 7. Implement Telegram group management service

  - [x] 7.1 Create group membership management
    - Implement GroupManagementService to add and remove users from Telegram group
    - Add error handling for group operation failures
    - Write unit tests for group management operations with mocked Telegram API
    - _Requirements: 2.1, 2.3, 3.3_

  - [x] 7.2 Implement group access validation
    - Create methods to verify user's current group membership status
    - Add logic to check if user should have group access based on subscription
    - Write unit tests for access validation scenarios
    - _Requirements: 2.4_

- [x] 8. Create Telegram bot controller and conversation handlers

  - [x] 8.1 Set up Telegram bot with Telegraf framework
    - Initialize Telegraf bot with token from environment configuration
    - Set up webhook or polling configuration for receiving messages
    - Write integration tests for bot initialization and basic connectivity
    - _Requirements: 5.2_

  - [x] 8.2 Implement start command and subscription package display
    - Create /start command handler that shows available subscription packages
    - Display pricing information and package duration options
    - Write unit tests for start command response formatting
    - _Requirements: 1.1_

  - [x] 8.3 Create subscription purchase flow handlers
    - Implement conversation handlers for package selection and phone number collection
    - Add payment initiation logic that calls Mpesa service
    - Write integration tests for complete purchase conversation flow
    - _Requirements: 1.2, 1.3_

  - [x] 8.4 Implement subscription status and renewal commands
    - Create command handlers to show current subscription status
    - Add renewal command that allows users to extend existing subscriptions
    - Write unit tests for status display and renewal command handlers
    - _Requirements: 4.1, 4.3_

- [x] 9. Create background scheduler for subscription management

  - [x] 9.1 Implement expiration notification scheduler
    - Create scheduled job to check for subscriptions expiring within 24 hours
    - Send expiration warning messages to users via Telegram
    - Write unit tests for expiration notification logic
    - _Requirements: 3.1_

  - [x] 9.2 Create subscription expiration processor
    - Implement scheduled job to process expired subscriptions
    - Add logic to remove expired users from group and send notifications
    - Write integration tests for expiration processing workflow
    - _Requirements: 3.2, 3.3_

- [x] 10. Create application entry point and configuration

  - [x] 10.1 Implement main application startup



    - Create main application file that initializes all services
    - Add environment variable validation and startup checks
    - Implement graceful shutdown handling
    - _Requirements: 5.4_

  - [x] 10.2 Set up Express server for webhook handling
    - Create Express server to handle Mpesa callbacks and health checks
    - Add middleware for request validation and error handling
    - Write integration tests for webhook endpoints
    - _Requirements: 5.1_

- [x] 11. Write comprehensive integration tests

  - [x] 11.1 Create end-to-end subscription purchase tests
    - Write tests that simulate complete user subscription purchase flow
    - Include payment processing and group access verification
    - Test error scenarios and recovery mechanisms
    - _Requirements: 1.1, 1.2, 1.3, 2.1_

  - [x] 11.2 Implement subscription renewal and expiration tests
    - Create tests for subscription renewal process
    - Test automatic expiration handling and user removal
    - Verify notification sending and group management
    - _Requirements: 3.1, 3.2, 4.1, 4.2_
