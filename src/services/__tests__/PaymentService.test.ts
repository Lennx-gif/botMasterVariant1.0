import axios from 'axios';
import { MpesaApiClient, PaymentService } from '../PaymentService';
import { getConfig, resetConfig } from '../../utils/config';
import { resetLogger } from '../../utils/logger';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock config
jest.mock('../../utils/config');
const mockedGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;

describe('MpesaApiClient', () => {
  let mpesaClient: MpesaApiClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    resetConfig();
    resetLogger();

    // Mock config
    mockedGetConfig.mockReturnValue({
      BOT_TOKEN: 'test_bot_token',
      GROUP_ID: 'test_group_id',
      MONGO_URI: 'mongodb://localhost:27017/test',
      SAFARICOM_CONSUMER_KEY: 'test_consumer_key',
      SAFARICOM_CONSUMER_SECRET: 'test_consumer_secret',
      MPESA_BASE_URL: 'https://sandbox.safaricom.co.ke',
      BUSINESS_SHORT_CODE: '174379',
      PASS_KEY: 'test_pass_key',
      CALLBACK_URL: 'https://test.com/callback',
      PORT: 3000,
      DAILY_PRICE: 50,
      WEEKLY_PRICE: 300,
      MONTHLY_PRICE: 1000,
    });

    // Mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      interceptors: {
        response: {
          use: jest.fn(),
        },
      },
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    mpesaClient = new MpesaApiClient();
  });

  describe('generateAccessToken', () => {
    it('should generate access token successfully', async () => {
      const mockResponse = {
        data: {
          access_token: 'test_access_token',
          expires_in: '3600',
        },
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const token = await mpesaClient.generateAccessToken();

      expect(token).toBe('test_access_token');
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/oauth/v1/generate?grant_type=client_credentials',
        {
          headers: {
            Authorization: 'Basic dGVzdF9jb25zdW1lcl9rZXk6dGVzdF9jb25zdW1lcl9zZWNyZXQ=',
          },
        }
      );
    });

    it('should return cached token if not expired', async () => {
      const mockResponse = {
        data: {
          access_token: 'test_access_token',
          expires_in: '3600',
        },
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      // First call
      const token1 = await mpesaClient.generateAccessToken();
      // Second call should use cached token
      const token2 = await mpesaClient.generateAccessToken();

      expect(token1).toBe('test_access_token');
      expect(token2).toBe('test_access_token');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
    });

    it('should generate new token if cached token is expired', async () => {
      const mockResponse1 = {
        data: {
          access_token: 'test_access_token_1',
          expires_in: '1', // 1 second expiry
        },
      };

      const mockResponse2 = {
        data: {
          access_token: 'test_access_token_2',
          expires_in: '3600',
        },
      };

      mockAxiosInstance.get
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      // First call
      const token1 = await mpesaClient.generateAccessToken();
      
      // Wait for token to expire (plus safety margin)
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Second call should generate new token
      const token2 = await mpesaClient.generateAccessToken();

      expect(token1).toBe('test_access_token_1');
      expect(token2).toBe('test_access_token_2');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });

    it('should throw error if no access token in response', async () => {
      const mockResponse = {
        data: {
          expires_in: '3600',
        },
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      await expect(mpesaClient.generateAccessToken()).rejects.toThrow(
        'No access token received from Mpesa API'
      );
    });

    it('should throw error if API request fails', async () => {
      const mockError = new Error('Network error');
      mockAxiosInstance.get.mockRejectedValue(mockError);

      await expect(mpesaClient.generateAccessToken()).rejects.toThrow(
        'Failed to authenticate with Mpesa API'
      );
    });

    it('should use correct base64 encoded credentials', async () => {
      const mockResponse = {
        data: {
          access_token: 'test_access_token',
          expires_in: '3600',
        },
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      await mpesaClient.generateAccessToken();

      const expectedCredentials = Buffer.from('test_consumer_key:test_consumer_secret').toString('base64');
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/oauth/v1/generate?grant_type=client_credentials',
        {
          headers: {
            Authorization: `Basic ${expectedCredentials}`,
          },
        }
      );
    });
  });

  describe('makeAuthenticatedRequest', () => {
    beforeEach(() => {
      const mockAuthResponse = {
        data: {
          access_token: 'test_access_token',
          expires_in: '3600',
        },
      };
      mockAxiosInstance.get.mockResolvedValue(mockAuthResponse);
    });

    it('should make authenticated GET request', async () => {
      const mockResponse = { data: { result: 'success' } };
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { access_token: 'test_access_token', expires_in: '3600' }
      }).mockResolvedValueOnce(mockResponse);

      const response = await mpesaClient.makeAuthenticatedRequest('GET', '/test-endpoint');

      expect(response).toBe(mockResponse);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/test-endpoint', {
        headers: {
          Authorization: 'Bearer test_access_token',
          'Content-Type': 'application/json',
        },
      });
    });

    it('should make authenticated POST request', async () => {
      const mockResponse = { data: { result: 'success' } };
      const testData = { test: 'data' };
      
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { access_token: 'test_access_token', expires_in: '3600' }
      });
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const response = await mpesaClient.makeAuthenticatedRequest('POST', '/test-endpoint', testData);

      expect(response).toBe(mockResponse);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/test-endpoint', testData, {
        headers: {
          Authorization: 'Bearer test_access_token',
          'Content-Type': 'application/json',
        },
      });
    });

    it('should handle authentication failure', async () => {
      const authError = new Error('Auth failed');
      mockAxiosInstance.get.mockRejectedValue(authError);

      await expect(
        mpesaClient.makeAuthenticatedRequest('GET', '/test-endpoint')
      ).rejects.toThrow('Failed to authenticate with Mpesa API');
    });
  });

  describe('clearAccessToken', () => {
    it('should clear cached access token', async () => {
      const mockResponse = {
        data: {
          access_token: 'test_access_token',
          expires_in: '3600',
        },
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      // Generate token
      await mpesaClient.generateAccessToken();
      
      // Clear token
      mpesaClient.clearAccessToken();
      
      // Next call should generate new token
      await mpesaClient.generateAccessToken();

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });
  });
});

describe('PaymentService', () => {
  let paymentService: PaymentService;
  let mockAxiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    resetConfig();
    resetLogger();

    mockedGetConfig.mockReturnValue({
      BOT_TOKEN: 'test_bot_token',
      GROUP_ID: 'test_group_id',
      MONGO_URI: 'mongodb://localhost:27017/test',
      SAFARICOM_CONSUMER_KEY: 'test_consumer_key',
      SAFARICOM_CONSUMER_SECRET: 'test_consumer_secret',
      MPESA_BASE_URL: 'https://sandbox.safaricom.co.ke',
      BUSINESS_SHORT_CODE: '174379',
      PASS_KEY: 'test_pass_key',
      CALLBACK_URL: 'https://test.com/callback',
      PORT: 3000,
      DAILY_PRICE: 50,
      WEEKLY_PRICE: 300,
      MONTHLY_PRICE: 1000,
    });

    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      interceptors: {
        response: {
          use: jest.fn(),
        },
      },
    } as any;

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    paymentService = new PaymentService();
  });

  describe('getMpesaClient', () => {
    it('should return MpesaApiClient instance', () => {
      const client = paymentService.getMpesaClient();
      expect(client).toBeInstanceOf(MpesaApiClient);
    });
  });

  describe('initiatePayment', () => {
    beforeEach(() => {
      // Mock successful authentication
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          access_token: 'test_access_token',
          expires_in: '3600',
        },
      });
    });

    it('should initiate payment successfully', async () => {
      const mockStkResponse = {
        data: {
          MerchantRequestID: 'test_merchant_id',
          CheckoutRequestID: 'test_checkout_id',
          ResponseCode: '0',
          ResponseDescription: 'Success',
          CustomerMessage: 'Check your phone for payment prompt'
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockStkResponse);

      const result = await paymentService.initiatePayment(
        '0701234567',
        100,
        'TEST_REF',
        'Test payment'
      );

      expect(result.success).toBe(true);
      expect(result.merchantRequestId).toBe('test_merchant_id');
      expect(result.checkoutRequestId).toBe('test_checkout_id');
      expect(result.message).toBe('Check your phone for payment prompt');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/mpesa/stkpush/v1/processrequest',
        expect.objectContaining({
          BusinessShortCode: '174379',
          TransactionType: 'CustomerPayBillOnline',
          Amount: 100,
          PartyA: '254701234567',
          PartyB: '174379',
          PhoneNumber: '254701234567',
          CallBackURL: 'https://test.com/callback',
          AccountReference: 'TEST_REF',
          TransactionDesc: 'Test payment'
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test_access_token'
          })
        })
      );
    });

    it('should handle different phone number formats', async () => {
      const mockStkResponse = {
        data: {
          MerchantRequestID: 'test_merchant_id',
          CheckoutRequestID: 'test_checkout_id',
          ResponseCode: '0',
          ResponseDescription: 'Success',
          CustomerMessage: 'Success'
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockStkResponse);

      // Test different phone number formats
      const phoneNumbers = [
        '0701234567',
        '254701234567',
        '701234567',
        '+254701234567'
      ];

      for (const phoneNumber of phoneNumbers) {
        await paymentService.initiatePayment(phoneNumber, 100, 'TEST_REF');
        
        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
          '/mpesa/stkpush/v1/processrequest',
          expect.objectContaining({
            PartyA: '254701234567',
            PhoneNumber: '254701234567'
          }),
          expect.any(Object)
        );
      }
    });

    it('should validate phone number format', async () => {
      const invalidPhoneNumbers = [
        '',
        '123456789',
        '0801234567', // Wrong network
        '25470123456', // Too short
        '2547012345678' // Too long
      ];

      for (const phoneNumber of invalidPhoneNumbers) {
        const result = await paymentService.initiatePayment(phoneNumber, 100, 'TEST_REF');
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('VALIDATION_ERROR');
        expect(result.message.toLowerCase()).toContain('phone number');
      }
    });

    it('should validate amount', async () => {
      const invalidAmounts = [0, -10, -1];

      for (const amount of invalidAmounts) {
        const result = await paymentService.initiatePayment('0701234567', amount, 'TEST_REF');
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('VALIDATION_ERROR');
        expect(result.message.toLowerCase()).toContain('amount');
      }
    });

    it('should validate account reference', async () => {
      const invalidReferences = [
        '',
        '   ',
        'VERY_LONG_REFERENCE_NAME' // Too long
      ];

      for (const reference of invalidReferences) {
        const result = await paymentService.initiatePayment('0701234567', 100, reference);
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('VALIDATION_ERROR');
        expect(result.message).toContain('reference');
      }
    });

    it('should handle STK Push failure response', async () => {
      const mockStkResponse = {
        data: {
          MerchantRequestID: '',
          CheckoutRequestID: '',
          ResponseCode: '1',
          ResponseDescription: 'Insufficient funds',
          CustomerMessage: 'Payment failed'
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockStkResponse);

      const result = await paymentService.initiatePayment('0701234567', 100, 'TEST_REF');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Insufficient funds');
      expect(result.error).toBe('STK_PUSH_FAILED');
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network timeout');
      mockAxiosInstance.post.mockRejectedValue(networkError);

      const result = await paymentService.initiatePayment('0701234567', 100, 'TEST_REF');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to process payment request. Please try again.');
      expect(result.error).toBe('PAYMENT_PROCESSING_ERROR');
    });

    it('should generate correct password and timestamp', async () => {
      const mockStkResponse = {
        data: {
          MerchantRequestID: 'test_merchant_id',
          CheckoutRequestID: 'test_checkout_id',
          ResponseCode: '0',
          ResponseDescription: 'Success',
          CustomerMessage: 'Success'
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockStkResponse);

      await paymentService.initiatePayment('0701234567', 100, 'TEST_REF');

      const callArgs = mockAxiosInstance.post.mock.calls[0][1];
      
      // Verify timestamp format (YYYYMMDDHHMMSS)
      expect(callArgs.Timestamp).toMatch(/^\d{14}$/);
      
      // Verify password is base64 encoded
      expect(callArgs.Password).toMatch(/^[A-Za-z0-9+/]+=*$/);
      
      // Verify password can be decoded
      const decodedPassword = Buffer.from(callArgs.Password, 'base64').toString();
      expect(decodedPassword).toContain('174379');
      expect(decodedPassword).toContain('test_pass_key');
      expect(decodedPassword).toContain(callArgs.Timestamp);
    });

    it('should use default transaction description when not provided', async () => {
      const mockStkResponse = {
        data: {
          MerchantRequestID: 'test_merchant_id',
          CheckoutRequestID: 'test_checkout_id',
          ResponseCode: '0',
          ResponseDescription: 'Success',
          CustomerMessage: 'Success'
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockStkResponse);

      await paymentService.initiatePayment('0701234567', 100, 'TEST_REF');

      const callArgs = mockAxiosInstance.post.mock.calls[0][1];
      expect(callArgs.TransactionDesc).toBe('Payment for TEST_REF');
    });
  });

  describe('verifyTransaction', () => {
    beforeEach(() => {
      // Mock successful authentication
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          access_token: 'test_access_token',
          expires_in: '3600',
        },
      });
    });

    it('should return completed for successful transaction', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          ResponseCode: '0',
          ResultCode: '0',
          ResultDesc: 'Success',
        },
      });
      const result = await paymentService.verifyTransaction('test_checkout_id');
      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.message).toBe('Transaction completed successfully');
    });

    it('should return failed for cancelled transaction', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          ResponseCode: '0',
          ResultCode: '1032',
          ResultDesc: 'Cancelled by user',
        },
      });
      const result = await paymentService.verifyTransaction('test_checkout_id');
      expect(result.success).toBe(true);
      expect(result.status).toBe('failed');
      expect(result.message).toContain('cancelled');
    });

    it('should return failed for timeout transaction', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          ResponseCode: '0',
          ResultCode: '1037',
          ResultDesc: 'Timeout',
        },
      });
      const result = await paymentService.verifyTransaction('test_checkout_id');
      expect(result.success).toBe(true);
      expect(result.status).toBe('failed');
      expect(result.message).toContain('timeout');
    });

    it('should return failed for insufficient funds', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          ResponseCode: '0',
          ResultCode: '1001',
          ResultDesc: 'Insufficient funds',
        },
      });
      const result = await paymentService.verifyTransaction('test_checkout_id');
      expect(result.success).toBe(true);
      expect(result.status).toBe('failed');
      expect(result.message).toContain('Insufficient funds');
    });

    it('should return failed for other failure codes', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          ResponseCode: '0',
          ResultCode: '9999',
          ResultDesc: 'Other failure',
        },
      });
      const result = await paymentService.verifyTransaction('test_checkout_id');
      expect(result.success).toBe(true);
      expect(result.status).toBe('failed');
      expect(result.message).toBe('Other failure');
    });

    it('should return pending for query failure', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          ResponseCode: '1',
          ResponseDescription: 'Query failed',
        },
      });
      const result = await paymentService.verifyTransaction('test_checkout_id');
      expect(result.success).toBe(false);
      expect(result.status).toBe('pending');
      expect(result.message).toBe('Query failed');
      expect(result.error).toBe('VERIFICATION_QUERY_FAILED');
    });

    it('should return failed for missing checkoutRequestId', async () => {
      const result = await paymentService.verifyTransaction('');
      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.error).toBe('INVALID_REQUEST_ID');
    });

    it('should return pending for network error', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Network error'));
      const result = await paymentService.verifyTransaction('test_checkout_id');
      expect(result.success).toBe(false);
      expect(result.status).toBe('pending');
      expect(result.error).toBe('VERIFICATION_ERROR');
    });
  });

  describe('getTransactionStatus', () => {
    beforeEach(() => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          access_token: 'test_access_token',
          expires_in: '3600',
        },
      });
    });

    it('should return on first successful verification', async () => {
      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: { ResponseCode: '1', ResponseDescription: 'Pending' } })
        .mockResolvedValueOnce({ data: { ResponseCode: '1', ResponseDescription: 'Pending' } })
        .mockResolvedValueOnce({ data: { ResponseCode: '0', ResultCode: '1001', ResultDesc: 'Insufficient funds' } });
      const result = await paymentService.getTransactionStatus('test_checkout_id', 3);
      expect(result.success).toBe(true);
      expect(result.status).toBe('failed');
      expect(result.message).toContain('Insufficient funds');
    });

    it('should retry and eventually return failed', async () => {
      // First two attempts: pending, last: failed
      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: { ResponseCode: '1', ResponseDescription: 'Pending' } })
        .mockResolvedValueOnce({ data: { ResponseCode: '1', ResponseDescription: 'Pending' } })
        .mockResolvedValueOnce({ data: { ResponseCode: '0', ResultCode: '1001', ResultDesc: 'Insufficient funds' } });
      const result = await paymentService.getTransactionStatus('test_checkout_id', 3);
      expect(result.success).toBe(true);
      expect(result.status).toBe('failed');
      expect(result.message).toContain('Insufficient funds');
    });

    it('should return last result if all attempts are pending', async () => {
      mockAxiosInstance.post
        .mockResolvedValue({ data: { ResponseCode: '1', ResponseDescription: 'Pending' } });
      const result = await paymentService.getTransactionStatus('test_checkout_id', 2);
      expect(result.success).toBe(false);
      expect(result.status).toBe('pending');
      expect(result.error).toBe('VERIFICATION_QUERY_FAILED');
    });
  });
});