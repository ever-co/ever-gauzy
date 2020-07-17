pipeline {
    agent {
        label 'docker'
    }

    environment {
        DOCKER_BUILDKIT = 1 // Experimental faster build system
    }

    stages {
        stage("Clone") {
            steps{
                git branch: 'develop',
                    url: 'https://github.com/ever-co/gauzy.git'
            }
            post {
                success {
                    echo "Cloning successful..."
                }
                failure {
                    echo "Cloning failed! See log for details. Terminating..."
                }
            }
        }
        stage("Docker Image Build") {
            parallel {
                stage("API Image") {
                    steps {
                        sh 'docker build -t gauzy-api -f .deploy/api/Dockerfile .'
                    }
                    post{
                        success {
                            echo "Image for API built!"
                        }
                        failure {
                            echo "API Image build failed..."
                        }
                    }
                }
                stage("Gauzy WebApp Image") {
                    steps {
                        sh 'docker build -t gauzy-webapp -f .deploy/webapp/Dockerfile .'
                    }
                    post {
                        success {
                            echo "Image for Webapp built!"
                        }
                        failure {
                            echo "Webapp image build failed..."
                        }
                    }
                }
            }
        }
    }
    post {
        success {
            echo "Gauzy CI/CD pipeline executed successfully!"
        }
        failure {
            echo "Gauzy CI/CD pipeline failed..."
        }
    }
}