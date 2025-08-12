import mongoose, { Document, Model } from 'mongoose';
export interface ITransaction extends Document {
    userId: mongoose.Types.ObjectId;
    transactionId: string;
    mpesaReceiptNumber?: string;
    phoneNumber: string;
    amount: number;
    status: 'pending' | 'completed' | 'failed';
    packageType: 'daily' | 'weekly' | 'monthly';
    createdAt: Date;
    completedAt?: Date;
    updatedAt: Date;
    complete(mpesaReceiptNumber: string): Promise<ITransaction>;
    fail(): Promise<ITransaction>;
    isPending(): boolean;
    isCompleted(): boolean;
    isFailed(): boolean;
}
export interface ITransactionModel extends Model<ITransaction> {
    findByTransactionId(transactionId: string): Promise<ITransaction | null>;
    findByUserId(userId: mongoose.Types.ObjectId): Promise<ITransaction[]>;
    findPendingTransactions(): Promise<ITransaction[]>;
    findByStatus(status: 'pending' | 'completed' | 'failed'): Promise<ITransaction[]>;
    findByPhoneNumber(phoneNumber: string): Promise<ITransaction[]>;
}
export declare const Transaction: ITransactionModel;
//# sourceMappingURL=Transaction.d.ts.map