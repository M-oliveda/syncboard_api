import {
    Body,
    Container,
    Head,
    Heading,
    Html,
    Preview,
    Text,
} from "@react-email/components";

interface WelcomeEmailProps {
    email: string;
}

export const WelcomeEmail = ({ email }: WelcomeEmailProps): React.JSX.Element => (
    <Html>
        <Head />
        <Preview>Welcome to SyncBoard</Preview>
        <Body>
            <Container>
                <Heading>Welcome to SyncBoard</Heading>
                <Text>
                    Your account ({email}) is ready. Create a workspace and invite your
                    team to start collaborating on boards in real time.
                </Text>
            </Container>
        </Body>
    </Html>
);
