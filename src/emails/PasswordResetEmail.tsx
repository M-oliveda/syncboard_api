import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Html,
    Preview,
    Text,
} from "@react-email/components";

interface PasswordResetEmailProps {
    resetUrl: string;
}

export const PasswordResetEmail = ({
    resetUrl,
}: PasswordResetEmailProps): React.JSX.Element => (
    <Html>
        <Head />
        <Preview>Reset your SyncBoard password</Preview>
        <Body>
            <Container>
                <Heading>Reset your password</Heading>
                <Text>
                    We received a request to reset your SyncBoard password. Click the
                    button below to choose a new one. This link expires in 1 hour.
                </Text>
                <Button href={resetUrl}>Reset password</Button>
                <Text>
                    If you didn&apos;t request this, you can safely ignore this email.
                </Text>
            </Container>
        </Body>
    </Html>
);
