import { Telegraf, Context, Markup, Scenes, session } from "telegraf";
import { getConfig } from "../utils/config";
import { UserService } from "../services/UserService";
import { SubscriptionService } from "../services/SubscriptionService";
import { AdminService } from "../services/AdminService";
import { SubscriptionRequest } from "../models/SubscriptionRequest";
import { logger } from "../utils/logger";

interface SessionData {
  packageType?: "daily" | "weekly" | "monthly";
  phoneNumber?: string;
  awaitingPhoneNumber?: boolean;
  awaitingConfirmation?: boolean;
}
interface BotContext extends Context {
  session: SessionData;
}

export class BotController {
  public bot: Telegraf<BotContext>;
  private userService: UserService;
  private subscriptionService: SubscriptionService;
  private adminService: AdminService;
  private logger = logger;

  constructor() {
    const config = getConfig();
    this.bot = new Telegraf<BotContext>(config.BOT_TOKEN);
    this.userService = new UserService();
    this.subscriptionService = new SubscriptionService();
    this.adminService = new AdminService(this.bot);
    this.bot.use(session());
    this.setupHandlers();
  }

  private setupHandlers() {
    // /start command
    this.bot.start(async (ctx) => {
      try {
        // Initialize session safely
        if (!ctx.session) {
          ctx.session = {};
        } else {
          ctx.session = {};
        }

        const config = getConfig();

        // Check if user has existing subscription or pending payments
        const existingSubscription =
          await this.subscriptionService.getSubscription(ctx.from.id);
        const user = await this.userService.getUser(ctx.from.id);

        let hasPendingPayment = false;
        if (user) {
          const { Transaction } = await import("../models/Transaction");
          const pendingTransaction = await Transaction.findOne({
            userId: user._id,
            status: "pending",
          }).sort({ createdAt: -1 });
          hasPendingPayment = !!pendingTransaction;
        }

        // Create different welcome messages based on user status
        let welcomeMessage = "🎉 *Welcome to the Telegram Purchase Bot!*\n\n";
        let buttons = [];

        if (existingSubscription) {
          const isExpired = new Date() > existingSubscription.endDate;
          if (isExpired) {
            welcomeMessage += `⏰ Your ${
              existingSubscription.packageType
            } subscription expired on ${existingSubscription.endDate.toLocaleString()}.\n\n`;
            welcomeMessage +=
              "🔄 You can renew your subscription or check your status:\n\n";
            buttons = [
              [Markup.button.callback("📊 Check Status", "check_status")],
              [
                Markup.button.callback(
                  "🔄 Renew Subscription",
                  "show_packages"
                ),
              ],
              ...(hasPendingPayment
                ? [
                    [
                      Markup.button.callback(
                        "🔍 Verify Payment",
                        "verify_payment"
                      ),
                    ],
                  ]
                : []),
            ];
          } else {
            welcomeMessage += `✅ You have an active ${
              existingSubscription.packageType
            } subscription until ${existingSubscription.endDate.toLocaleString()}.\n\n`;
            welcomeMessage += "🎯 What would you like to do?\n\n";
            buttons = [
              [Markup.button.callback("📊 Check Status", "check_status")],
              [Markup.button.callback("🔗 Get Group Access", "get_access")],
              [
                Markup.button.callback(
                  "🔄 Extend Subscription",
                  "show_packages"
                ),
              ],
            ];
          }
        } else if (hasPendingPayment) {
          welcomeMessage +=
            "⏳ You have a pending payment that needs verification.\n\n";
          welcomeMessage += "🎯 What would you like to do?\n\n";
          buttons = [
            [Markup.button.callback("🔍 Verify Payment", "verify_payment")],
            [Markup.button.callback("🛒 New Purchase", "show_packages")],
          ];
        } else {
          welcomeMessage +=
            "🔒 Get exclusive access to our premium group with these subscription packages:\n\n";
          welcomeMessage += `💎 Daily: KES ${config.DAILY_PRICE}\n`;
          welcomeMessage += `⭐ Weekly: KES ${config.WEEKLY_PRICE}\n`;
          welcomeMessage += `🏆 Monthly: KES ${config.MONTHLY_PRICE}\n\n`;
          welcomeMessage += "🎯 What would you like to do?\n\n";
          buttons = [
            [
              Markup.button.callback(
                "🛒 Purchase Subscription",
                "show_packages"
              ),
            ],
            [Markup.button.callback("📊 Check Status", "check_status")],
          ];
        }

        await ctx.reply(welcomeMessage, {
          parse_mode: "Markdown",
          reply_markup: Markup.inlineKeyboard(buttons).reply_markup,
        });

        this.logger.info("Start command completed successfully", {
          userId: ctx.from.id,
          username: ctx.from.username || "No username",
          hasExistingSubscription: !!existingSubscription,
          hasPendingPayment,
        });
      } catch (error) {
        this.logger.error(
          "Error in start command:",
          error instanceof Error ? error : new Error(String(error)),
          {
            userId: ctx.from.id,
            username: ctx.from.username || "No username",
          }
        );
        await ctx.reply(
          "❌ Error loading options.\n\n" +
            "Please try again or contact support if the problem persists."
        );
      }
    });

    // Show packages action
    this.bot.action("show_packages", async (ctx) => {
      try {
        if (!ctx.session) {
          ctx.session = {};
        }

        const config = getConfig();

        await ctx.editMessageText(
          "🛒 *Choose Your Subscription Package*\n\n" +
            `💎 Daily: KES ${config.DAILY_PRICE} - Perfect for trying out\n` +
            `⭐ Weekly: KES ${config.WEEKLY_PRICE} - Great value for regular users\n` +
            `🏆 Monthly: KES ${config.MONTHLY_PRICE} - Best value for committed users\n\n` +
            "👇 Select a package:",
          {
            parse_mode: "Markdown",
            reply_markup: Markup.inlineKeyboard([
              [
                Markup.button.callback(
                  `Daily - KES ${config.DAILY_PRICE}`,
                  "buy_daily"
                ),
              ],
              [
                Markup.button.callback(
                  `Weekly - KES ${config.WEEKLY_PRICE}`,
                  "buy_weekly"
                ),
              ],
              [
                Markup.button.callback(
                  `Monthly - KES ${config.MONTHLY_PRICE}`,
                  "buy_monthly"
                ),
              ],
              [Markup.button.callback("⬅️ Back to Menu", "back_to_start")],
            ]).reply_markup,
          }
        );

        await ctx.answerCbQuery();
      } catch (error) {
        this.logger.error(
          "Error showing packages:",
          error instanceof Error ? error : new Error(String(error))
        );
        await ctx.answerCbQuery("Error loading packages");
      }
    });

    // Check status action
    this.bot.action("check_status", async (ctx) => {
      try {
        const status = await this.subscriptionService.getSubscription(
          ctx.from.id
        );

        if (!status) {
          await ctx.editMessageText(
            "❌ *No Subscription Found*\n\n" +
              "You do not have any subscription records.\n\n" +
              "🚀 Purchase your first subscription to get started!",
            {
              parse_mode: "Markdown",
              reply_markup: Markup.inlineKeyboard([
                [
                  Markup.button.callback(
                    "🛒 Purchase Subscription",
                    "show_packages"
                  ),
                ],
                [Markup.button.callback("⬅️ Back to Menu", "back_to_start")],
              ]).reply_markup,
            }
          );
        } else {
          const isExpired = new Date() > status.endDate;
          const statusEmoji =
            status.status === "active" && !isExpired ? "✅" : "❌";
          const statusText =
            status.status === "active" && !isExpired ? "Active" : "Expired";

          await ctx.editMessageText(
            `${statusEmoji} *Subscription Status*\n\n` +
              `📦 Package: ${
                status.packageType.charAt(0).toUpperCase() +
                status.packageType.slice(1)
              }\n` +
              `🔄 Status: ${statusText}\n` +
              `💰 Amount: KES ${status.amount}\n` +
              `📅 Started: ${
                status.startDate ? status.startDate.toLocaleString() : "N/A"
              }\n` +
              `⏰ Expires: ${status.endDate.toLocaleString()}\n\n` +
              `${
                isExpired
                  ? "🔄 Consider renewing your subscription"
                  : "🎉 Your subscription is active!"
              }`,
            {
              parse_mode: "Markdown",
              reply_markup: Markup.inlineKeyboard([
                [
                  isExpired
                    ? Markup.button.callback("🔄 Renew Now", "show_packages")
                    : Markup.button.callback(
                        "🔗 Get Group Access",
                        "get_access"
                      ),
                ],
                [Markup.button.callback("⬅️ Back to Menu", "back_to_start")],
              ]).reply_markup,
            }
          );
        }

        await ctx.answerCbQuery();
      } catch (error) {
        this.logger.error(
          "Error checking status:",
          error instanceof Error ? error : new Error(String(error))
        );
        await ctx.answerCbQuery("Error checking status");
      }
    });

    // Check requests action - show user's subscription requests
    this.bot.action("verify_payment", async (ctx) => {
      try {
        const requests = await SubscriptionRequest.findByTelegramId(
          ctx.from.id
        );

        if (requests.length === 0) {
          await ctx.editMessageText(
            "📋 *No Subscription Requests Found*\n\n" +
              "You have no subscription requests.\n" +
              "Submit a new request to get started! or contact @whaart",
            {
              parse_mode: "Markdown",
              reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback("🛒 New Request", "show_packages")],
                [Markup.button.callback("⬅️ Back to Menu", "back_to_start")],
              ]).reply_markup,
            }
          );
          await ctx.answerCbQuery();
          return;
        }

        const latestRequest = requests[0];
        if (!latestRequest) {
          await ctx.editMessageText(
            "📋 *No Subscription Requests Found*\n\n" +
              "You have no subscription requests.\n" +
              "Submit a new request to get started!",
            {
              parse_mode: "Markdown",
              reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback("🛒 New Request", "show_packages")],
                [Markup.button.callback("⬅️ Back to Menu", "back_to_start")],
              ]).reply_markup,
            }
          );
          await ctx.answerCbQuery();
          return;
        }

        const statusEmoji =
          latestRequest.status === "approved"
            ? "✅"
            : latestRequest.status === "rejected"
            ? "❌"
            : "⏳";

        await ctx.editMessageText(
          `📋 *YOUR LATEST REQUEST*\n\n` +
            `${statusEmoji} Status: ${latestRequest.status.toUpperCase()}\n` +
            `📦 Package: ${
              latestRequest.packageType.charAt(0).toUpperCase() +
              latestRequest.packageType.slice(1)
            }\n` +
            `📅 Requested: ${latestRequest.requestedAt.toLocaleString()}\n` +
            `${
              latestRequest.processedAt
                ? `⏰ Processed: ${latestRequest.processedAt.toLocaleString()}\n`
                : ""
            }` +
            `${
              latestRequest.notes ? `📝 Notes: ${latestRequest.notes}\n` : ""
            }\n` +
            `${
              latestRequest.status === "pending"
                ? "Please wait for admin approval."
                : ""
            }`,
          {
            parse_mode: "Markdown",
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.callback("📊 Check Status", "check_status")],
              [Markup.button.callback("⬅️ Back to Menu", "back_to_start")],
            ]).reply_markup,
          }
        );

        await ctx.answerCbQuery();
      } catch (error) {
        this.logger.error(
          "Error checking requests:",
          error instanceof Error ? error : new Error(String(error))
        );
        await ctx.answerCbQuery("Error checking requests");
      }
    });

    // Get access action
    this.bot.action("get_access", async (ctx) => {
      try {
        const subscription = await this.subscriptionService.getSubscription(
          ctx.from.id
        );

        if (
          !subscription ||
          subscription.status !== "active" ||
          new Date() > subscription.endDate
        ) {
          await ctx.editMessageText(
            "❌ *No Active Subscription*\n\n" +
              "You need an active subscription to access the group.",
            {
              parse_mode: "Markdown",
              reply_markup: Markup.inlineKeyboard([
                [
                  Markup.button.callback(
                    "🛒 Purchase Subscription",
                    "show_packages"
                  ),
                ],
                [Markup.button.callback("⬅️ Back to Menu", "back_to_start")],
              ]).reply_markup,
            }
          );
          await ctx.answerCbQuery();
          return;
        }

        const { GroupManagementService } = await import(
          "../services/GroupManagementService"
        );
        const groupService = new GroupManagementService();
        const result = await groupService.addUserToGroup(ctx.from.id);

        if (result.success) {
          await ctx.editMessageText(
            "✅ *GROUP ACCESS GRANTED*\n\n" +
              "🔗 You should receive a group invitation link shortly.\n" +
              "Check your messages from this bot!\n\n" +
              "📅 Your subscription is valid until: " +
              subscription.endDate.toLocaleString(),
            {
              parse_mode: "Markdown",
              reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback("📊 Check Status", "check_status")],
                [Markup.button.callback("⬅️ Back to Menu", "back_to_start")],
              ]).reply_markup,
            }
          );
        } else {
          await ctx.editMessageText(
            "⚠️ *Group Access Issue*\n\n" +
              "Unable to generate group access automatically.\n\n" +
              "📞 Please contact support for manual assistance.",
            {
              parse_mode: "Markdown",
              reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback("📊 Check Status", "check_status")],
                [Markup.button.callback("⬅️ Back to Menu", "back_to_start")],
              ]).reply_markup,
            }
          );
        }

        await ctx.answerCbQuery();
      } catch (error) {
        this.logger.error(
          "Error getting access:",
          error instanceof Error ? error : new Error(String(error))
        );
        await ctx.answerCbQuery("Error processing request");
      }
    });

    // Back to start action
    this.bot.action("back_to_start", async (ctx) => {
      // Trigger the start command logic
      await this.bot.handleUpdate({
        update_id: Date.now(),
        message: {
          message_id: Date.now(),
          from: ctx.from,
          chat: ctx.chat!,
          date: Math.floor(Date.now() / 1000),
          text: "/start",
        },
      } as any);
      await ctx.answerCbQuery();
    });

    // Package selection
    this.bot.action(/buy_(daily|weekly|monthly)/, async (ctx) => {
      try {
        const type = ctx.match[1] as "daily" | "weekly" | "monthly";

        // Initialize session if needed
        if (!ctx.session) {
          ctx.session = {};
        }

        ctx.session.packageType = type;
        ctx.session.awaitingPhoneNumber = true;

        const config = getConfig();
        const price =
          type === "daily"
            ? config.DAILY_PRICE
            : type === "weekly"
            ? config.WEEKLY_PRICE
            : config.MONTHLY_PRICE;

        await ctx.reply(
          `📦 *${
            type.charAt(0).toUpperCase() + type.slice(1)
          } Package Selected*\n\n` +
            `💰 Price: KES ${price}\n\n` +
            "📱 Please enter your phone number (optional):\n" +
            "• Format: 254XXXXXXXXX (e.g., 254712345678)\n" +
            '• Or type "skip" to proceed without phone number',
          { parse_mode: "Markdown" }
        );

        await ctx.answerCbQuery(
          `${type.charAt(0).toUpperCase() + type.slice(1)} package selected`
        );

        this.logger.info("Package selection completed", {
          userId: ctx.from.id,
          username: ctx.from.username || "No username",
          packageType: type,
          price,
        });
      } catch (error) {
        this.logger.error(
          "Error in package selection:",
          error instanceof Error ? error : new Error(String(error)),
          {
            userId: ctx.from.id,
            username: ctx.from.username || "No username",
          }
        );
        await ctx.answerCbQuery("Error selecting package");
        await ctx.reply("❌ Error selecting package. Please try /start again.");
      }
    });

    // Handle text messages (phone numbers and confirmations)
    this.bot.on("text", async (ctx) => {
      // Initialize session if it doesn't exist
      if (!ctx.session) {
        ctx.session = {};
      }

      const text = ctx.message.text.trim();

      // Handle phone number input
      if (ctx.session.awaitingPhoneNumber && ctx.session.packageType) {
        let phoneNumber: string | undefined;

        if (text.toLowerCase() === "skip") {
          phoneNumber = undefined;
        } else if (/^254[17]\d{8}$/.test(text)) {
          phoneNumber = text;
        } else {
          await ctx.reply(
            "❌ Invalid phone number format.\n\n" +
              "✅ Please enter a valid Kenyan phone number:\n" +
              "• Format: 254XXXXXXXXX\n" +
              "• Example: 254712345678\n" +
              '• Or type "skip" to proceed without phone number'
          );
          return;
        }

        if (phoneNumber) {
          ctx.session.phoneNumber = phoneNumber;
        }
        ctx.session.awaitingPhoneNumber = false;
        ctx.session.awaitingConfirmation = true;

        const config = getConfig();
        const price =
          ctx.session.packageType === "daily"
            ? config.DAILY_PRICE
            : ctx.session.packageType === "weekly"
            ? config.WEEKLY_PRICE
            : config.MONTHLY_PRICE;

        await ctx.reply(
          `📋 *CONFIRM YOUR REQUEST*\n\n` +
            `📦 Package: ${
              ctx.session.packageType.charAt(0).toUpperCase() +
              ctx.session.packageType.slice(1)
            }\n` +
            `💰 Price: KES ${price}\n` +
            `📱 Phone: ${phoneNumber || "Not provided"}\n\n` +
            `Your request will be sent to admin for approval.\n` +
            `You'll be notified once it's processed.\n\n` +
            `Type "confirm" to submit or "cancel" to abort:`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Handle confirmation
      if (ctx.session.awaitingConfirmation && ctx.session.packageType) {
        if (text.toLowerCase() === "confirm") {
          try {
            this.logger.info("Starting request submission process", {
              userId: ctx.from.id,
              packageType: ctx.session.packageType,
              phoneNumber: ctx.session.phoneNumber
                ? "provided"
                : "not provided",
            });

            // Register/update user
            const user = await this.userService.createUser(
              ctx.from.id,
              ctx.from.username || `user_${ctx.from.id}`,
              ctx.session.phoneNumber
            );

            this.logger.info("User created/updated successfully", {
              userId: ctx.from.id,
              username: ctx.from.username || "No username",
              userDbId: user._id,
              phoneNumber: ctx.session.phoneNumber
                ? "provided"
                : "not provided",
            });

            // Check for existing pending request
            const existingRequest =
              await SubscriptionRequest.findPendingByTelegramId(ctx.from.id);
            if (existingRequest) {
              this.logger.info("Found existing pending request", {
                userId: ctx.from.id,
                existingRequestId: existingRequest._id,
              });

              await ctx.reply(
                "⚠️ You already have a pending subscription request.\n\n" +
                  "Please wait for admin approval or contact support."
              );
              ctx.session = {};
              return;
            }

            // Create subscription request
            this.logger.info("Creating new subscription request", {
              userId: ctx.from.id,
              username: ctx.from.username || "No username",
              packageType: ctx.session.packageType,
            });

            const request = new SubscriptionRequest({
              userId: user._id,
              telegramId: ctx.from.id,
              username: ctx.from.username || `user_${ctx.from.id}`,
              phoneNumber: ctx.session.phoneNumber,
              packageType: ctx.session.packageType,
              status: "pending",
            });

            await request.save();

            this.logger.info("Subscription request saved to database", {
              requestId: request._id,
              userId: ctx.from.id,
              username: ctx.from.username || "No username",
              packageType: ctx.session.packageType,
              phoneNumber: ctx.session.phoneNumber
                ? "provided"
                : "not provided",
            });

            // Log request submission (no automated notification)
            this.logger.info(
              "Subscription request created, user will contact admin directly",
              {
                requestId: request._id,
                userId: ctx.from.id,
                packageType: ctx.session.packageType,
              }
            );

            await ctx.reply(
              `✅ *REQUEST SUBMITTED!*\n\n` +
                `Your ${ctx.session.packageType} subscription request has been created successfully.\n\n` +
                `👤 Username: @${ctx.from.username || "No username"}\n` +
                `📋 Request ID: ${request._id}\n` +
                `⏰ Submitted: ${new Date().toLocaleString()}\n\n` +
                `📞 *NEXT STEP: Contact Admin for Approval*\n` +
                `Please send a direct message to the admin: @${
                  getConfig().ADMIN_USERNAME
                }\n\n` +
                `📝 *Include this information in your message:*\n` +
                `• Request ID: ${request._id}\n` +
                `• Package: ${ctx.session.packageType}\n` +
                `• Your username: @${ctx.from.username || "No username"}\n\n` +
                `💡 The admin will approve your request and add you to the group.\n\n` +
                `Use /status to check your current subscription status.`,
              { parse_mode: "Markdown" }
            );

            this.logger.info("Subscription request submitted successfully", {
              requestId: request._id,
              userId: ctx.from.id,
              username: ctx.from.username || "No username",
              packageType: ctx.session.packageType,
              phoneNumber: ctx.session.phoneNumber || "Not provided",
            });
          } catch (error) {
            this.logger.error(
              "Error submitting subscription request:",
              error instanceof Error ? error : new Error(String(error)),
              {
                userId: ctx.from.id,
                username: ctx.from.username || "No username",
                packageType: ctx.session.packageType,
                phoneNumber: ctx.session.phoneNumber || "Not provided",
              }
            );
            await ctx.reply(
              "❌ Error submitting request. Please try again or contact support."
            );
          }
        } else if (text.toLowerCase() === "cancel") {
          await ctx.reply("❌ Request cancelled. Use /start to begin again.");
        } else {
          await ctx.reply(
            'Please type "confirm" to submit your request or "cancel" to abort.'
          );
          return;
        }

        // Clear session
        ctx.session = {};
        return;
      }

      // Handle random text
      if (!text.startsWith("/")) {
        await ctx.reply(
          "Please use /start to begin or /status to check your subscription."
        );
      }
    });

    // /status command
    this.bot.command("status", async (ctx) => {
      try {
        this.logger.info("Status command called", {
          userId: ctx.from.id,
          username: ctx.from.username || "No username",
        });

        const status = await this.subscriptionService.getSubscription(
          ctx.from.id
        );

        if (!status) {
          await ctx.reply(
            "❌ *No Subscription Found*\n\n" +
              "You do not have any subscription records.\n\n" +
              "🚀 Use /start to purchase your first subscription!",
            { parse_mode: "Markdown" }
          );
          return;
        }

        // Check if subscription is expired
        const isExpired = new Date() > status.endDate;
        const statusEmoji =
          status.status === "active" && !isExpired ? "✅" : "❌";
        const statusText =
          status.status === "active" && !isExpired ? "Active" : "Expired";

        await ctx.reply(
          `${statusEmoji} *Subscription Status*\n\n` +
            `📦 Package: ${
              status.packageType.charAt(0).toUpperCase() +
              status.packageType.slice(1)
            }\n` +
            `🔄 Status: ${statusText}\n` +
            `💰 Amount: KES ${status.amount}\n` +
            `📅 Started: ${
              status.startDate ? status.startDate.toLocaleString() : "N/A"
            }\n` +
            `⏰ Expires: ${status.endDate.toLocaleString()}\n\n` +
            `${
              isExpired
                ? "🔄 Use /renew to extend your subscription"
                : "🎉 Your subscription is active!"
            }`,
          { parse_mode: "Markdown" }
        );

        this.logger.info("Status command completed successfully", {
          userId: ctx.from.id,
          username: ctx.from.username || "No username",
          subscriptionStatus: status.status,
          isExpired,
        });
      } catch (error) {
        this.logger.error(
          "Error in status command:",
          error instanceof Error ? error : new Error(String(error)),
          {
            userId: ctx.from.id,
            username: ctx.from.username || "No username",
          }
        );
        await ctx.reply(
          "❌ Error retrieving subscription status.\n\n" +
            "Please try again or contact support if the problem persists."
        );
      }
    });

    // /renew command
    this.bot.command("renew", async (ctx) => {
      try {
        this.logger.info("Renew command called", {
          userId: ctx.from.id,
          username: ctx.from.username || "No username",
        });

        // Clear session safely
        if (ctx.session) {
          ctx.session = {};
        }

        const config = getConfig();

        // Check if user has any previous subscriptions
        const currentStatus = await this.subscriptionService.getSubscription(
          ctx.from.id
        );

        let renewalMessage = "🔄 *Renew Your Subscription*\n\n";

        if (currentStatus) {
          const isExpired = new Date() > currentStatus.endDate;
          if (isExpired) {
            renewalMessage += `Your ${
              currentStatus.packageType
            } subscription expired on ${currentStatus.endDate.toLocaleString()}.\n\n`;
          } else {
            renewalMessage += `Your ${
              currentStatus.packageType
            } subscription is active until ${currentStatus.endDate.toLocaleString()}.\n\n`;
          }
        }

        renewalMessage += "Choose a package to renew:";

        await ctx.reply(renewalMessage, {
          parse_mode: "Markdown",
          reply_markup: Markup.inlineKeyboard([
            [
              Markup.button.callback(
                `Daily - KES ${config.DAILY_PRICE}`,
                "buy_daily"
              ),
            ],
            [
              Markup.button.callback(
                `Weekly - KES ${config.WEEKLY_PRICE}`,
                "buy_weekly"
              ),
            ],
            [
              Markup.button.callback(
                `Monthly - KES ${config.MONTHLY_PRICE}`,
                "buy_monthly"
              ),
            ],
          ]).reply_markup,
        });

        this.logger.info("Renew command completed successfully", {
          userId: ctx.from.id,
          username: ctx.from.username || "No username",
        });
      } catch (error) {
        this.logger.error(
          "Error in renew command:",
          error instanceof Error ? error : new Error(String(error)),
          {
            userId: ctx.from.id,
            username: ctx.from.username || "No username",
          }
        );
        await ctx.reply(
          "❌ Error loading renewal options.\n\n" +
            "Please try again or use /start to purchase a new subscription."
        );
      }
    });

    // /help command
    this.bot.command("help", async (ctx) => {
      try {
        const config = getConfig();
        const isAdmin = this.adminService.isAdmin(ctx.from.id);

        let helpMessage =
          "🤖 *Telegram Purchase Bot Help*\n\n" +
          "📋 *Available Commands:*\n" +
          "• /start - Start subscription request process\n" +
          "• /status - Check subscription status\n" +
          "• /renew - Request subscription renewal\n" +
          "• /access - Request group access (if you have active subscription)\n" +
          "• /help - Show this help message\n\n";

        if (isAdmin) {
          helpMessage +=
            "👑 *Admin Commands:*\n" +
            "• /pending - View pending subscription requests\n" +
            "• /user <id> - Lookup user by Telegram ID\n" +
            "• /checkexpired - Check expired subscriptions\n\n";
        }

        helpMessage +=
          "💰 *Subscription Packages:*\n" +
          `• Daily: KES ${config.DAILY_PRICE}\n` +
          `• Weekly: KES ${config.WEEKLY_PRICE}\n` +
          `• Monthly: KES ${config.MONTHLY_PRICE}\n\n` +
          "📋 *Process:* Submit request → Contact admin → Get approved → Group access\n" +
          `🔒 *Admin Contact:* @${config.ADMIN_USERNAME}\n\n` +
          "❓ *Need help?* Contact the admin directly.";

        await ctx.reply(helpMessage, { parse_mode: "Markdown" });
      } catch (error) {
        this.logger.error(
          "Error in help command:",
          error instanceof Error ? error : new Error(String(error))
        );
        await ctx.reply("❌ Error loading help information. Please try again.");
      }
    });

    // /requests command - for users to check their request status
    this.bot.command("requests", async (ctx) => {
      try {
        const requests = await SubscriptionRequest.findByTelegramId(
          ctx.from.id
        );

        if (requests.length === 0) {
          await ctx.reply(
            "📋 You have no subscription requests. Use /start to submit one."
          );
          return;
        }

        let message = `📋 *YOUR SUBSCRIPTION REQUESTS*\n\n`;

        for (const request of requests.slice(0, 5)) {
          const statusEmoji =
            request.status === "approved"
              ? "✅"
              : request.status === "rejected"
              ? "❌"
              : "⏳";

          message += `${statusEmoji} ${
            request.packageType.charAt(0).toUpperCase() +
            request.packageType.slice(1)
          }\n`;
          message += `📅 ${request.requestedAt.toLocaleString()}\n`;
          message += `🔄 Status: ${request.status}\n`;

          if (request.processedAt) {
            message += `⏰ Processed: ${request.processedAt.toLocaleString()}\n`;
          }

          if (request.notes) {
            message += `📝 Notes: ${request.notes}\n`;
          }

          message += "\n";
        }

        if (requests.length > 5) {
          message += `... and ${requests.length - 5} more requests`;
        }

        await ctx.reply(message, { parse_mode: "Markdown" });
      } catch (error) {
        this.logger.error(
          "Error in requests command:",
          error instanceof Error ? error : new Error(String(error))
        );
        await ctx.reply("❌ Error fetching your requests.");
      }
    });

    // /access command - for users who have active subscription but need group access
    this.bot.command("access", async (ctx) => {
      try {
        const subscription = await this.subscriptionService.getSubscription(
          ctx.from.id
        );

        if (!subscription || subscription.status !== "active") {
          await ctx.reply(
            "❌ No active subscription found.\n\n" +
              "Please purchase a subscription first using /start"
          );
          return;
        }

        // Check if subscription is still valid
        if (new Date() > subscription.endDate) {
          await ctx.reply(
            "⏰ Your subscription has expired.\n\n" +
              "Please renew your subscription using /renew"
          );
          return;
        }

        // Import GroupManagementService
        const { GroupManagementService } = await import(
          "../services/GroupManagementService"
        );
        const groupService = new GroupManagementService();

        // Try to add user to group
        const result = await groupService.addUserToGroup(ctx.from.id);

        if (result.success) {
          await ctx.reply(
            "✅ *GROUP ACCESS GRANTED*\n\n" +
              "🔗 You should receive a group invitation link shortly.\n" +
              "Check your messages from this bot!\n\n" +
              "📅 Your subscription is valid until: " +
              subscription.endDate.toLocaleString(),
            { parse_mode: "Markdown" }
          );

          this.logger.info("Manual group access granted", {
            userId: ctx.from.id,
            subscriptionId: subscription._id,
          });
        } else {
          await ctx.reply(
            "⚠️ Unable to generate group access automatically.\n\n" +
              "📞 Please contact support with the following details:\n" +
              `• User ID: ${ctx.from.id}\n` +
              `• Subscription: ${subscription.packageType}\n` +
              `• Valid until: ${subscription.endDate.toLocaleString()}\n\n` +
              "We will add you to the group manually within 24 hours."
          );

          this.logger.warn("Manual group access failed", {
            userId: ctx.from.id,
            subscriptionId: subscription._id,
            error: result.error,
          });
        }
      } catch (error) {
        this.logger.error(
          "Error in access command:",
          error instanceof Error ? error : new Error(String(error))
        );
        await ctx.reply(
          "An error occurred while processing your request. Please try again later."
        );
      }
    });

    // Admin commands
    this.bot.command("pending", async (ctx) => {
      if (!this.adminService.isAdmin(ctx.from.id)) {
        await ctx.reply("❌ This command is only available to administrators.");
        return;
      }

      try {
        await this.adminService.sendPendingRequestsSummary();
      } catch (error) {
        this.logger.error(
          "Error in pending command:",
          error instanceof Error ? error : new Error(String(error))
        );
        await ctx.reply("❌ Error fetching pending requests.");
      }
    });

    // Handle admin approval/rejection callbacks
    this.bot.action(/^(approve|reject)_(.+)$/, async (ctx) => {
      if (!ctx.from?.id || !this.adminService.isAdmin(ctx.from.id)) {
        await ctx.answerCbQuery("❌ Unauthorized");
        return;
      }

      const action = ctx.match[1];
      const requestId = ctx.match[2];
      const adminId = ctx.from.id;

      if (!requestId) {
        await ctx.answerCbQuery("❌ Invalid request ID");
        return;
      }

      try {
        let result;
        if (action === "approve") {
          result = await this.adminService.approveRequest(requestId, adminId);
        } else {
          result = await this.adminService.rejectRequest(requestId, adminId);
        }

        if (result.success) {
          const originalText =
            "text" in ctx.callbackQuery.message!
              ? ctx.callbackQuery.message.text
              : "Request processed";
          await ctx.editMessageText(originalText + `\n\n${result.message}`, {
            parse_mode: "Markdown",
          });
        } else {
          await ctx.answerCbQuery(`❌ ${result.message}`);
        }
      } catch (error) {
        this.logger.error(
          "Error processing admin action:",
          error instanceof Error ? error : new Error(String(error))
        );
        await ctx.answerCbQuery("❌ Error processing request");
      }

      await ctx.answerCbQuery();
    });

    // /checkexpired command - for debugging expired subscriptions
    this.bot.command("checkexpired", async (ctx) => {
      if (!this.adminService.isAdmin(ctx.from.id)) {
        await ctx.reply("❌ This command is only available to administrators.");
        return;
      }

      try {
        this.logger.info("Check expired command called", {
          userId: ctx.from.id,
        });

        const { Subscription } = await import("../models/Subscription");
        const expiredSubs = await Subscription.findExpiredSubscriptions();

        if (expiredSubs.length === 0) {
          await ctx.reply("✅ No expired subscriptions found.");
          return;
        }

        let message = `⚠️ Found ${expiredSubs.length} expired subscription(s):\n\n`;

        for (const sub of expiredSubs.slice(0, 5)) {
          // Show max 5 to avoid message length issues
          const { User } = await import("../models/User");
          const user = await User.findById(sub.userId);
          message += `• User: ${user?.telegramId || "Unknown"}\n`;
          message += `  Package: ${sub.packageType}\n`;
          message += `  Expired: ${sub.endDate.toLocaleString()}\n\n`;
        }

        if (expiredSubs.length > 5) {
          message += `... and ${expiredSubs.length - 5} more`;
        }

        await ctx.reply(message);
      } catch (error) {
        this.logger.error(
          "Error in checkexpired command:",
          error instanceof Error ? error : new Error(String(error))
        );
        await ctx.reply("❌ Error checking expired subscriptions.");
      }
    });

    // /user command - for admins to lookup user by ID
    this.bot.command("user", async (ctx) => {
      if (!this.adminService.isAdmin(ctx.from.id)) {
        await ctx.reply("❌ This command is only available to administrators.");
        return;
      }

      try {
        const args = ctx.message.text.split(" ");
        if (args.length < 2) {
          await ctx.reply(
            "📋 *User Lookup Command*\n\n" +
              "Usage: `/user <telegram_id>`\n\n" +
              "Example: `/user 123456789`\n\n" +
              "This will show user details, subscription status, and recent requests.",
            { parse_mode: "Markdown" }
          );
          return;
        }

        const telegramId = parseInt(args[1] || "");
        if (isNaN(telegramId)) {
          await ctx.reply(
            "❌ Invalid user ID. Please provide a valid Telegram ID number."
          );
          return;
        }

        this.logger.info("Admin user lookup", {
          adminId: ctx.from.id,
          lookupUserId: telegramId,
        });

        // Get user information
        const user = await this.userService.getUser(telegramId);
        if (!user) {
          await ctx.reply(
            `❌ User with ID ${telegramId} not found in database.`
          );
          return;
        }

        // Get subscription status
        const subscription = await this.subscriptionService.getSubscription(
          telegramId
        );

        // Get recent subscription requests
        const requests = await SubscriptionRequest.findByTelegramId(telegramId);
        const recentRequests = requests.slice(0, 3); // Show last 3 requests

        // Build user info message
        let message = `👤 *USER INFORMATION*\n\n`;
        message += `🆔 Telegram ID: \`${user.telegramId}\`\n`;
        message += `👤 Username: ${
          user.username ? `@${user.username}` : "Not set"
        }\n`;
        message += `📱 Phone: ${user.phoneNumber || "Not provided"}\n`;
        message += `📅 Joined: ${user.createdAt.toLocaleString()}\n\n`;

        // Subscription status
        message += `📦 *SUBSCRIPTION STATUS*\n`;
        if (subscription) {
          const isExpired = new Date() > subscription.endDate;
          const statusEmoji =
            subscription.status === "active" && !isExpired ? "✅" : "❌";
          message += `${statusEmoji} Status: ${
            subscription.status === "active" && !isExpired
              ? "Active"
              : "Expired"
          }\n`;
          message += `📦 Package: ${
            subscription.packageType.charAt(0).toUpperCase() +
            subscription.packageType.slice(1)
          }\n`;
          message += `💰 Amount: KES ${subscription.amount}\n`;
          message += `📅 Started: ${
            subscription.startDate?.toLocaleString() || "N/A"
          }\n`;
          message += `⏰ Expires: ${subscription.endDate.toLocaleString()}\n\n`;
        } else {
          message += `❌ No active subscription\n\n`;
        }

        // Recent requests
        if (recentRequests.length > 0) {
          message += `📋 *RECENT REQUESTS* (${requests.length} total)\n`;
          for (const request of recentRequests) {
            const statusEmoji =
              request.status === "approved"
                ? "✅"
                : request.status === "rejected"
                ? "❌"
                : "⏳";
            message += `${statusEmoji} ${
              request.packageType
            } - ${request.requestedAt.toLocaleDateString()}\n`;
          }
          message += `\n`;
        }

        // Admin actions
        message += `🔧 *ADMIN ACTIONS*\n`;
        message += `• Send message: Contact user directly\n`;
        message += `• Check group status: Verify group membership\n`;
        message += `• View all requests: Use /requests command`;

        await ctx.reply(message, { parse_mode: "Markdown" });
      } catch (error) {
        this.logger.error(
          "Error in user lookup command:",
          error instanceof Error ? error : new Error(String(error)),
          { adminId: ctx.from.id }
        );
        await ctx.reply("❌ Error looking up user information.");
      }
    });

    // Handle unknown commands
    this.bot.on("message", async (ctx, next) => {
      if ("text" in ctx.message && ctx.message.text.startsWith("/")) {
        const command = ctx.message.text.split(" ")[0];
        if (
          command &&
          ![
            "start",
            "status",
            "renew",
            "help",
            "access",
            "requests",
            "pending",
            "user",
            "checkexpired",
          ].includes(command.substring(1))
        ) {
          await ctx.reply(
            "❓ Unknown command. Use /help to see available commands."
          );
          return;
        }
      }
      return next();
    });
  }

  /**
   * Launch the bot with retry logic for network issues
   */
  async launch(
    maxRetries: number = 3,
    retryDelay: number = 5000
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.info(
          `Attempting to launch bot (attempt ${attempt}/${maxRetries})`
        );

        // Test the connection first
        await this.bot.telegram.getMe();
        this.logger.info("Bot token validated successfully");

        // Launch the bot
        await this.bot.launch();
        this.logger.info("Telegram bot launched successfully");
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.error(`Bot launch attempt ${attempt} failed:`, lastError, {
          attempt,
          maxRetries,
          willRetry: attempt < maxRetries,
        });

        if (attempt < maxRetries) {
          this.logger.info(`Waiting ${retryDelay}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }
    }

    // If we get here, all attempts failed
    if (lastError) {
      this.logger.error("All bot launch attempts failed", lastError);
      throw new Error(
        `Failed to launch bot after ${maxRetries} attempts. Last error: ${lastError.message}`
      );
    } else {
      throw new Error(
        `Failed to launch bot after ${maxRetries} attempts. No error details available.`
      );
    }
  }
}
