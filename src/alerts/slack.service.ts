import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  private readonly webhookUrl: string;

  constructor() {
    this.webhookUrl = process.env.ALERTS_WEBHOOK_URL;
  }

  /**
   * Sends an alert notification for critical errors
   * @param errorTitle Short title describing the error
   * @param errorDetails Detailed error information
   * @param metadata Additional contextual data
   */
  async sendErrorAlert(
    errorTitle: string,
    errorDetails: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      if (!this.webhookUrl) {
        this.logger.warn("AlertsService: No webhook URL configured for alerts");
        return;
      }

      const payload = {
        title: `🚨 ERROR: ${errorTitle}`,
        details:
          errorDetails instanceof Error
            ? errorDetails.message
            : String(errorDetails),
        stack: errorDetails instanceof Error ? errorDetails.stack : undefined,
        timestamp: new Date().toISOString(),
        environment: "production",
        metadata,
      };

      await axios.post(this.webhookUrl, {
        text: JSON.stringify(payload, null, 2),
      });
      this.logger.debug(`Alert sent: ${errorTitle}`);
    } catch (error) {
      // We don't want alerts failure to disrupt the application flow
      this.logger.log("Failed to send error alert", error);
    }
  }
}
