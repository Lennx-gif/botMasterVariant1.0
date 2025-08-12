import { PaymentCallbackController } from '../PaymentCallbackController';
import { Request, Response } from 'express';
import { PaymentService } from '../../services/PaymentService';
import { Transaction } from '../../models/Transaction';

jest.mock('../../services/PaymentService');
jest.mock('../../models/Transaction');

const mockResponse = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

describe('PaymentCallbackController', () => {
  let controller: PaymentCallbackController;
  let req: Partial<Request>;
  let res: Response;

  beforeEach(() => {
    controller = new PaymentCallbackController();
    req = { body: {} };
    res = mockResponse();
    jest.clearAllMocks();
  });

  it('should return 400 for invalid callback data', async () => {
    req.body = { invalid: true };
    await controller.handleCallback(req as Request, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('should return 200 and process valid successful callback', async () => {
    req.body = {
      Body: {
        stkCallback: {
          MerchantRequestID: 'mid',
          CheckoutRequestID: 'cid',
          ResultCode: 0,
          ResultDesc: 'Success',
          CallbackMetadata: {
            Item: [
              { Name: 'MpesaReceiptNumber', Value: 'MPE123' }
            ]
          }
        }
      }
    };
    (Transaction.findByTransactionId as jest.Mock).mockResolvedValue({
      transactionId: 'cid',
      isPending: () => true,
      complete: jest.fn(),
      userId: 'user1',
    });
    await controller.handleCallback(req as Request, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('should return 200 and process valid failed callback', async () => {
    req.body = {
      Body: {
        stkCallback: {
          MerchantRequestID: 'mid',
          CheckoutRequestID: 'cid',
          ResultCode: 1,
          ResultDesc: 'Failed',
        }
      }
    };
    (Transaction.findByTransactionId as jest.Mock).mockResolvedValue({
      transactionId: 'cid',
      isPending: () => true,
      fail: jest.fn(),
      userId: 'user1',
    });
    await controller.handleCallback(req as Request, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('should return 200 and handle already processed transaction', async () => {
    req.body = {
      Body: {
        stkCallback: {
          MerchantRequestID: 'mid',
          CheckoutRequestID: 'cid',
          ResultCode: 0,
          ResultDesc: 'Success',
          CallbackMetadata: {
            Item: [
              { Name: 'MpesaReceiptNumber', Value: 'MPE123' }
            ]
          }
        }
      }
    };
    (Transaction.findByTransactionId as jest.Mock).mockResolvedValue({
      transactionId: 'cid',
      isPending: () => false,
      status: 'completed',
      userId: 'user1',
    });
    await controller.handleCallback(req as Request, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, message: 'Transaction already processed' }));
  });

  it('should return 200 and handle transaction not found', async () => {
    req.body = {
      Body: {
        stkCallback: {
          MerchantRequestID: 'mid',
          CheckoutRequestID: 'cid',
          ResultCode: 0,
          ResultDesc: 'Success',
          CallbackMetadata: {
            Item: [
              { Name: 'MpesaReceiptNumber', Value: 'MPE123' }
            ]
          }
        }
      }
    };
    (Transaction.findByTransactionId as jest.Mock).mockResolvedValue(null);
    await controller.handleCallback(req as Request, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'Transaction not found' }));
  });

  it('should handle missing receipt number in successful callback', async () => {
    req.body = {
      Body: {
        stkCallback: {
          MerchantRequestID: 'mid',
          CheckoutRequestID: 'cid',
          ResultCode: 0,
          ResultDesc: 'Success',
          CallbackMetadata: { Item: [] }
        }
      }
    };
    (Transaction.findByTransactionId as jest.Mock).mockResolvedValue({
      transactionId: 'cid',
      isPending: () => true,
      complete: jest.fn(),
      fail: jest.fn(),
      userId: 'user1',
    });
    await controller.handleCallback(req as Request, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, error: 'RECEIPT_NUMBER_MISSING' }));
  });
}); 